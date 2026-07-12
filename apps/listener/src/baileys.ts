import baileys, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  Browsers,
  type WASocket,
} from '@whiskeysockets/baileys';

// Baileys ships the factory as the default export; NodeNext types surface it as
// a namespace, so normalise to a callable.
const makeWASocket = ((baileys as any).default ?? baileys) as (config: any) => WASocket;
import qrcode from 'qrcode-terminal';
import { writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { loadEnv, logger } from '@wma/shared';

export interface ConnectionState {
  connected: boolean;
  lastQr: string | null;
  meJid: string | null;
  lastConnectedAt: Date | null;
}

export const connectionState: ConnectionState = {
  connected: false,
  lastQr: null,
  meJid: null,
  lastConnectedAt: null,
};

export interface SocketHandlers {
  onReady?: (sock: WASocket) => void;
  bind: (sock: WASocket) => void;
}

const baileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL ?? 'silent' });

/**
 * Create and maintain a single Baileys connection. Persists auth in WA_AUTH_DIR
 * (mount a volume in production) and auto-reconnects unless logged out.
 */
export async function startConnection(handlers: SocketHandlers): Promise<WASocket> {
  const env = loadEnv();
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const authDir = isAbsolute(env.WA_AUTH_DIR) ? env.WA_AUTH_DIR : resolve(workspaceRoot, env.WA_AUTH_DIR);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: baileysLogger,
    printQRInTerminal: false,
    // A stable, "official-looking" browser identity for linking reliability.
    browser: Browsers.macOS('Safari'),
    auth: {
      creds: state.creds,
      // Use the raw key store (no cache wrapper) — the cache can race the
      // post-pairing key exchange and surface as badSession (500).
      keys: state.keys,
    },
    markOnlineOnConnect: false,
    emitOwnEvents: true,
    // The control chat is operated from the owner's primary phone. Keep history
    // sync enabled so this linked-device session receives those owner-sent
    // messages and can execute commands like /status.
    syncFullHistory: true,
    // Keep each QR valid longer so it isn't rotated mid-scan.
    qrTimeout: 60_000,
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing-code flow: request an 8-char code instead of showing a QR.
  if (env.WA_USE_PAIRING_CODE && env.OWNER_PHONE && !sock.authState.creds.registered) {
    const phone = env.OWNER_PHONE.replace(/\D/g, '');
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phone);
        const pretty = code.match(/.{1,4}/g)?.join('-') ?? code;
        logger.info({ pairingCode: pretty }, 'PAIRING CODE — enter it in WhatsApp → Linked devices → Link with phone number');
        console.log(`\n========================================\n  CÓDIGO DE VINCULACIÓN: ${pretty}\n========================================\n`);
      } catch (err) {
        logger.error({ err: (err as Error).message }, 'requestPairingCode failed — falling back to QR');
      }
    }, 3000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      connectionState.lastQr = qr;
      if (!env.WA_USE_PAIRING_CODE) {
        logger.info('scan the QR below to link WhatsApp');
        qrcode.generate(qr, { small: true });
        // Persist the raw QR payload so external tooling can render it.
        try {
          writeFileSync('wa-qr.txt', qr, 'utf8');
        } catch {
          /* ignore */
        }
      }
    }
    if (connection === 'open') {
      connectionState.connected = true;
      connectionState.lastQr = null;
      connectionState.meJid = sock.user?.id ?? null;
      connectionState.lastConnectedAt = new Date();
      logger.info({ me: connectionState.meJid }, 'WhatsApp connection open');
      handlers.onReady?.(sock);
    }
    if (connection === 'close') {
      connectionState.connected = false;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      logger.warn({ statusCode, loggedOut }, 'WhatsApp connection closed');
      if (!loggedOut) {
        setTimeout(() => {
          startConnection(handlers).catch((e) =>
            logger.error({ err: (e as Error).message }, 'reconnect failed'),
          );
        }, 3000);
      } else {
        logger.error('logged out — delete WA_AUTH_DIR and re-link to continue');
      }
    }
  });

  handlers.bind(sock);
  return sock;
}
