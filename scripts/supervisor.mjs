import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

const executable = process.platform === 'win32' ? process.execPath : 'corepack';
const executablePrefix =
  process.platform === 'win32'
    ? [join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js')]
    : [];
const services = [
  { name: 'listener', filter: 'listener' },
  { name: 'worker', filter: 'worker' },
  { name: 'dashboard', filter: 'dashboard' },
];
const children = new Map();
let shuttingDown = false;

function launch(service, attempt = 0) {
  if (shuttingDown) return;
  const child = spawn(executable, [...executablePrefix, 'pnpm', '--filter', service.filter, 'start'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  children.set(service.name, child);
  console.log(`[supervisor] ${service.name} iniciado (pid ${child.pid})`);

  child.on('exit', (code, signal) => {
    children.delete(service.name);
    if (shuttingDown) return;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
    console.error(`[supervisor] ${service.name} terminó (${signal ?? code}); reinicio en ${delay / 1000}s`);
    setTimeout(() => launch(service, attempt + 1), delay).unref();
  });
}

function backup() {
  const child = spawn(process.execPath, ['--env-file=.env', 'scripts/backup.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  child.on('error', (error) => console.error('[supervisor] backup no iniciado', error.message));
}

for (const service of services) launch(service);
backup();
const backupTimer = setInterval(backup, 24 * 60 * 60 * 1000);
backupTimer.unref();

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(backupTimer);
  for (const [name, child] of children) {
    console.log(`[supervisor] cerrando ${name}`);
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
