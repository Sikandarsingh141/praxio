const { spawn } = require('node:child_process');

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error('Run this script with `npm start` so npm can be located.');
}

const npm = process.execPath;
const processes = [
  spawn(npm, [npmCli, 'run', 'start:dev', '--prefix', 'backend'], {
    cwd: __dirname,
    stdio: 'inherit',
  }),
  spawn(npm, [npmCli, 'start', '--prefix', 'frontend'], {
    cwd: __dirname,
    stdio: 'inherit',
  }),
];

let stopping = false;

function stopProcesses(signal) {
  if (stopping) {
    return;
  }

  stopping = true;
  for (const child of processes) {
    if (child.exitCode === null && !child.killed) {
      child.kill(signal);
    }
  }
}

for (const child of processes) {
  child.on('error', (error) => {
    console.error('Failed to start an application process:', error);
    stopProcesses('SIGTERM');
    process.exitCode = 1;
  });

  child.on('exit', (code, signal) => {
    if (!stopping) {
      process.exitCode = code ?? (signal ? 1 : 0);
      stopProcesses('SIGTERM');
    }
  });
}

process.on('SIGINT', () => stopProcesses('SIGINT'));
process.on('SIGTERM', () => stopProcesses('SIGTERM'));
