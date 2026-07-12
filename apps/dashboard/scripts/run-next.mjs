const [, , command, ...args] = process.argv;

if (!command) {
  throw new Error('A Next.js command is required');
}

const nextArgs = [...args];
if ((command === 'start' || command === 'dev') && process.env.PORT) {
  const portFlagIndex = nextArgs.findIndex((arg) => arg === '-p' || arg === '--port');
  if (portFlagIndex >= 0) {
    nextArgs.splice(portFlagIndex, 2);
  }
  nextArgs.push('-p', process.env.PORT);
}

process.env.NODE_ENV = command === 'dev' ? 'development' : 'production';
process.argv = [process.argv[0], 'next', command, ...nextArgs];

await import('next/dist/bin/next');
