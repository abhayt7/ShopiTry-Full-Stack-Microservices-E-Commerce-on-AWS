// Starts all 6 microservices locally with prefixed logs.  Usage: node start-all.js
const { spawn } = require('child_process'); const path = require('path');
const services = [['gateway-service',5000],['catalog-service',5001],['cart-service',5002],['order-service',5003],['payment-service',5004],['notification-service',5005]];
const procs = services.map(([name, port]) => {
  const p = spawn('node', ['server.js'], { cwd: path.join(__dirname, 'backend', name), env: process.env });
  const tag = `[${name}:${port}]`;
  p.stdout.on('data', (d) => process.stdout.write(`${tag} ${d}`)); p.stderr.on('data', (d) => process.stderr.write(`${tag} ${d}`));
  p.on('exit', (c) => console.log(`${tag} exited (${c})`)); return p;
});
const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
console.log('ShopiTry cluster starting... press Ctrl+C to stop.');
