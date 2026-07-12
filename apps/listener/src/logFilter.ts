const SESSION_DUMP_STARTS = ['Closing session: SessionEntry', 'Removing old closed session: SessionEntry'];
const FILTERED_LINE_PATTERNS = [
  '  _chains:',
  'registrationId:',
  'previousCounter:',
  'signedKeyId:',
  'preKeyId:',
  'created:',
  'used:',
  'closed:',
  'currentRatchet:',
  'ephemeralKeyPair:',
  'indexInfo:',
  'pendingPreKey:',
  'lastRemoteEphemeralKey:',
  'remoteIdentityKey:',
  'rootKey:',
  'privKey:',
  'pubKey:',
  'baseKey:',
  'chainKey:',
  '<Buffer ',
];

installSignalSessionLogFilter(process.stdout);
installSignalSessionLogFilter(process.stderr);

function installSignalSessionLogFilter(stream: NodeJS.WriteStream): void {
  if (process.env.DISABLE_SIGNAL_LOG_FILTER === 'true') return;

  const originalWrite = stream.write.bind(stream) as typeof stream.write;
  let suppressLines = 0;

  stream.write = ((chunk: unknown, encoding?: unknown, callback?: unknown): boolean => {
    const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : null;
    if (!text) return originalWrite(chunk as never, encoding as never, callback as never);

    const kept: string[] = [];
    for (const line of splitPreservingNewline(text)) {
      if (shouldSuppressLine(line, suppressLines > 0)) {
        suppressLines = Math.max(suppressLines - 1, 0);
        if (isSessionDumpStart(line)) suppressLines = 80;
        continue;
      }
      kept.push(line);
    }

    if (kept.length === 0) {
      if (typeof callback === 'function') callback();
      return true;
    }
    return originalWrite(kept.join('') as never, encoding as never, callback as never);
  }) as typeof stream.write;
}

function shouldSuppressLine(line: string, inSessionDump: boolean): boolean {
  if (isSessionDumpStart(line)) return true;
  if (inSessionDump) return true;
  return FILTERED_LINE_PATTERNS.some((pattern) => line.includes(pattern));
}

function isSessionDumpStart(line: string): boolean {
  return SESSION_DUMP_STARTS.some((start) => line.includes(start));
}

function splitPreservingNewline(text: string): string[] {
  const matches = text.match(/[^\n]*\n|[^\n]+/g);
  return matches ?? [];
}
