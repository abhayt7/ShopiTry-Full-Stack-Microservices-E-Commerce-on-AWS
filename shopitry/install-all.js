// Installs npm dependencies in every service and both frontends.
const { spawnSync } = require('child_process'); const path = require('path');
const dirs = ['backend/gateway-service','backend/catalog-service','backend/cart-service','backend/order-service','backend/payment-service','backend/notification-service','frontend/storefront','frontend/admin-dashboard'];
for (const d of dirs) { console.log(`\n=== npm install: ${d}`); const r = spawnSync('npm', ['install'], { cwd: path.join(__dirname, d), stdio: 'inherit', shell: true }); if (r.status) process.exit(r.status); }
