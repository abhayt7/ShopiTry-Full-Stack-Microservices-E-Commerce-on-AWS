// PM2 process file for EC2.  Run:  pm2 start ecosystem.config.js && pm2 save && pm2 startup
const svc = (name, extra = {}) => ({ name, cwd: `./backend/${name}`, script: 'server.js', instances: 1, autorestart: true, max_memory_restart: '300M', env: { NODE_ENV: 'production', ...extra } });
module.exports = { apps: [svc('gateway-service'), svc('catalog-service'), svc('cart-service'), svc('order-service')] };
