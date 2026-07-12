/**
 * Privacy boundary for message content.
 *
 * `null` means the permission could not be loaded. It intentionally behaves
 * like `false` so infrastructure failures cannot broaden what gets ingested.
 */
export function shouldIngestMessage(isControl: boolean, readEnabled: boolean | null): boolean {
  return isControl || readEnabled === true;
}

