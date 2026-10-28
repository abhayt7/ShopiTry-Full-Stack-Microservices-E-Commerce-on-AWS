// Frees ports 5000-5005 if a previous run left processes behind.
const { execSync } = require('child_process');
for (let port = 5000; port <= 5005; port++) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set(out.split('\n').map((l) => l.trim().split(/\s+/).pop()).filter((p) => /^\d+$/.test(p) && p !== '0'));
      pids.forEach((pid) => execSync(`taskkill /PID ${pid} /F`));
    } else {
      execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: 'ignore', shell: '/bin/sh' });
    }
    console.log(`port ${port} cleaned`);
  } catch { console.log(`port ${port} already free`); }
}
