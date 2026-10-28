// ShopiTry API Gateway: auth (JWT), RBAC, CORS, rate limiting, reverse proxy.
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.GATEWAY_PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const URLS = {
  catalog: process.env.CATALOG_URL || 'http://localhost:5001',
  cart: process.env.CART_URL || 'http://localhost:5002',
  orders: process.env.ORDER_URL || 'http://localhost:5003',
  payment: process.env.PAYMENT_URL || 'http://localhost:5004',
  notification: process.env.NOTIFICATION_URL || 'http://localhost:5005',
};

const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
}, { timestamps: true }));

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',') }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// Never trust identity headers coming from the outside world.
app.use((req, _res, next) => {
  delete req.headers['x-user-id']; delete req.headers['x-user-role']; delete req.headers['x-user-email'];
  next();
});

const sign = (u) => jwt.sign({ id: String(u._id), email: u.email, role: u.role, name: u.name }, JWT_SECRET, { expiresIn: '8h' });
const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

const authenticate = (required) => (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return required ? res.status(401).json({ error: 'Authentication required' }) : next();
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
};
const requireRole = (role) => (req, res, next) =>
  req.user && req.user.role === role ? next() : res.status(403).json({ error: `${role} role required` });

// ---- Auth routes (JSON body parsed only here, so proxied bodies stay untouched) ----
app.post('/api/auth/register', express.json(), async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'name, email and password (min 8 chars) required' });
  if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already registered' });
  const u = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(u), user: publicUser(u) });
});
app.post('/api/auth/login', express.json(), async (req, res) => {
  const { email, password } = req.body || {};
  const u = await User.findOne({ email: (email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(password || '', u.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: sign(u), user: publicUser(u) });
});
app.get('/api/auth/me', authenticate(true), (req, res) => res.json({ user: req.user }));

// ---- Cluster health (used by the telemetry monitor in both UIs) ----
const probe = async (name, base) => {
  const t = Date.now();
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    return { name, status: r.ok ? 'UP' : 'DEGRADED', latencyMs: Date.now() - t };
  } catch { return { name, status: 'DOWN', latencyMs: null }; }
};
app.get('/api/health', async (_req, res) => {
  const services = await Promise.all([
    probe('catalog-service', URLS.catalog), probe('cart-service', URLS.cart), probe('order-service', URLS.orders),
    probe('payment-service', URLS.payment), probe('notification-service', URLS.notification),
  ]);
  res.json({ gateway: 'UP', services, checkedAt: new Date().toISOString() });
});
app.get('/health', (_req, res) => res.json({ status: 'UP' }));

// ---- Proxy (identity forwarded as trusted headers) ----
const proxy = (ctx, target) => createProxyMiddleware(ctx, {
  target, changeOrigin: true,
  onProxyReq: (proxyReq, req) => {
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.id);
      proxyReq.setHeader('x-user-role', req.user.role);
      proxyReq.setHeader('x-user-email', req.user.email);
    }
  },
  onError: (_e, _req, res) => res.status(502).json({ error: 'Upstream service unavailable' }),
});

// Catalog: reads are public, writes need admin
app.use('/api/catalog', (req, res, next) => {
  if (req.method === 'GET') return authenticate(false)(req, res, next);
  authenticate(true)(req, res, () => requireRole('admin')(req, res, next));
});
app.use(proxy('/api/catalog', URLS.catalog));
// Cart & orders: login required (order-service enforces admin-only transitions/stats too)
app.use('/api/cart', authenticate(true));
app.use(proxy('/api/cart', URLS.cart));
app.use('/api/orders', authenticate(true));
app.use(proxy('/api/orders', URLS.orders));
// Payment & notification services are internal-only: called by order-service, NOT exposed here.

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

async function seedUsers() {
  const seeds = [
    { name: 'Elena Customer', email: 'elena@example.com', password: 'customerpassword123', role: 'customer' },
    { name: 'Shop Admin', email: 'admin@shopitry.com', password: 'adminpassword123', role: 'admin' },
  ];
  for (const s of seeds) if (!(await User.findOne({ email: s.email })))
    await User.create({ name: s.name, email: s.email, role: s.role, passwordHash: await bcrypt.hash(s.password, 10) });
}
app.listen(PORT, () => console.log(`[gateway] listening on :${PORT}`));
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000, dbName: 'auth_db' });
    await seedUsers();
    console.log('[gateway] MongoDB connected, demo users ready');
  } catch (e) { console.error('[gateway] MongoDB connection failed:', e.message); }
})();
