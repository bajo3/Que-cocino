import { query } from './pool.js';
import { SETTINGS_KEYS } from '@wma/shared';

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const { rows } = await query<{ value: T }>('select value from wa_settings where key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await query(
    `insert into wa_settings(key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function isListenPaused(): Promise<boolean> {
  return (await getSetting<boolean>(SETTINGS_KEYS.listenPaused)) === true;
}

export async function isSendPaused(): Promise<boolean> {
  return (await getSetting<boolean>(SETTINGS_KEYS.sendPaused)) === true;
}

export async function setListenPaused(paused: boolean): Promise<void> {
  await setSetting(SETTINGS_KEYS.listenPaused, paused);
}

export async function setSendPaused(paused: boolean): Promise<void> {
  await setSetting(SETTINGS_KEYS.sendPaused, paused);
}
