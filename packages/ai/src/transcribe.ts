import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { toFile } from 'openai';
import { loadEnv } from '@wma/shared';
import { getTranscriptionLLM } from './openai.js';

const execFileAsync = promisify(execFile);

/**
 * Transcribe audio with Z.AI GLM-ASR first, falling back to OpenAI when
 * configured. WhatsApp OGG/Opus is converted to 16 kHz mono WAV and split
 * into API-safe chunks, so longer voice notes remain processable.
 */
export async function transcribeAudio(
  buffer: Buffer,
  opts: { filename?: string; mime?: string } = {},
): Promise<string | null> {
  const env = loadEnv();
  if (env.ZAI_API_KEY) {
    try {
      return await transcribeWithZai(buffer, opts);
    } catch (error) {
      if (!env.OPENAI_API_KEY) throw error;
    }
  }

  const llm = getTranscriptionLLM();
  if (!llm) return null;
  const file = await toFile(buffer, opts.filename ?? 'audio.ogg', { type: opts.mime ?? 'audio/ogg' });
  const res = await llm.client.audio.transcriptions.create({ model: llm.model, file });
  return res.text ?? null;
}

async function transcribeWithZai(
  buffer: Buffer,
  opts: { filename?: string; mime?: string },
): Promise<string | null> {
  const env = loadEnv();
  const chunks = await convertToWavChunks(buffer, opts.filename, opts.mime);
  const transcripts: string[] = [];

  for (let index = 0; index < chunks.length; index++) {
    const form = new FormData();
    form.append('model', env.ZAI_TRANSCRIPTION_MODEL);
    form.append('stream', 'false');
    if (transcripts.length > 0) {
      form.append('prompt', transcripts.join(' ').slice(-4000));
    }
    form.append(
      'file',
      new Blob([new Uint8Array(chunks[index]!)], { type: 'audio/wav' }),
      `audio-${index + 1}.wav`,
    );

    const response = await fetch(`${env.ZAI_BASE_URL.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.ZAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Z.AI transcription failed (${response.status}): ${detail}`);
    }
    const result = (await response.json()) as { text?: string };
    if (result.text?.trim()) transcripts.push(result.text.trim());
  }

  return transcripts.join(' ').trim() || null;
}

async function convertToWavChunks(buffer: Buffer, filename?: string, mime?: string): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), 'wma-asr-'));
  const fallbackExt = mime?.includes('mpeg') ? '.mp3' : mime?.includes('wav') ? '.wav' : '.ogg';
  const inputExt = extname(filename ?? '') || fallbackExt;
  const inputPath = join(dir, `input${inputExt}`);
  const outputPattern = join(dir, 'chunk-%03d.wav');

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inputPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-f',
        'segment',
        '-segment_time',
        '29',
        '-reset_timestamps',
        '1',
        outputPattern,
      ],
      { maxBuffer: 1024 * 1024 },
    );

    const files = (await readdir(dir)).filter((name) => /^chunk-\d+\.wav$/.test(name)).sort();
    if (files.length === 0) throw new Error('ffmpeg produced no transcription chunks');
    return Promise.all(files.map((name) => readFile(join(dir, name))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
