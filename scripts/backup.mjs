import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { query, closePool } from '../packages/db/dist/index.js';

const gzipAsync = promisify(gzip);
const tables = [
  '_migrations',
  'wa_accounts',
  'wa_chats',
  'wa_contacts',
  'wa_group_participants',
  'wa_messages',
  'wa_audio_transcripts',
  'wa_message_embeddings',
  'wa_chat_summaries',
  'wa_contact_profiles',
  'wa_contact_aliases',
  'wa_labels',
  'wa_chat_labels',
  'wa_tasks',
  'wa_reply_drafts',
  'wa_style_profiles',
  'wa_ai_usage',
  'wa_finance_entries',
  'wa_actions',
  'wa_command_logs',
  'wa_settings',
];

const outputDir = join(process.cwd(), 'backups');
await mkdir(outputDir, { recursive: true });
const payload = { createdAt: new Date().toISOString(), version: 1, tables: {} };

try {
  for (const table of tables) {
    try {
      const { rows } = await query(`select * from ${table}`);
      payload.tables[table] = rows;
    } catch (error) {
      payload.tables[table] = { error: error.message };
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(outputDir, `wabot-${stamp}.json.gz`);
  await writeFile(target, await gzipAsync(JSON.stringify(payload)));
  console.log(`[backup] creado ${target}`);

  const existing = (await readdir(outputDir))
    .filter((name) => /^wabot-.*\.json\.gz$/.test(name))
    .sort()
    .reverse();
  for (const old of existing.slice(14)) await unlink(join(outputDir, old));
} finally {
  await closePool();
}
