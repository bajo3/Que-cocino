import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { logger } from '@wma/shared';
import { unwrap, audioDurationSeconds } from './extract.js';

export interface DownloadedAudio {
  buffer: Buffer;
  mime: string;
  ext: string;
  seconds: number | null;
}

/** Minimal socket surface required to re-upload expired media. */
export interface MediaReuploadSocket {
  updateMediaMessage: (msg: any) => Promise<any>;
}

/**
 * AudioProcessor — listener-side. Downloads a voice note from a live Baileys
 * message. Transcription happens in the worker (see @wma/ai transcribeAudio),
 * so a failure here never blocks message persistence.
 */
export class AudioProcessor {
  constructor(private readonly sock: MediaReuploadSocket) {}

  async download(fullMessage: any): Promise<DownloadedAudio> {
    const buffer = (await downloadMediaMessage(
      fullMessage,
      'buffer',
      {},
      {
        logger: logger as any,
        reuploadRequest: this.sock.updateMediaMessage.bind(this.sock),
      },
    )) as Buffer;

    const audioNode = unwrap(fullMessage?.message)?.audioMessage;
    const mime: string = audioNode?.mimetype ?? 'audio/ogg';
    const ext = mimeToExt(mime);
    return { buffer, mime, ext, seconds: audioDurationSeconds(fullMessage?.message) };
  }
}

function mimeToExt(mime: string): string {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('amr')) return 'amr';
  return 'ogg';
}
