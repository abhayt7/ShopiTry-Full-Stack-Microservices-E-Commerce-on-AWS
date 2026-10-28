const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const mongoose = require('mongoose');
const PORT = process.env.ORDER_PORT || 5003;
const CART_URL = process.env.CART_URL || 'http://localhost:5002';
const PAYMENT_URL = process.env.PAYMENT_URL || 'http://localhost:5004';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://localhost:5005';

// Order state machine: PENDING -> PAID -> PROCESSING -> SHIPPED -> DELIVERED (cancel allowed early)
const TRANSITIONS = {
  PENDING: ['PAID', 'CANCELLED'], PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED'], SHIPPED: ['DELIVERED'], DELIVERED: [], CANCELLED: [],
};
const Order = mongoose.model('Order', new mongoose.Schema({
  userId: String, userEmail: String,
  items: [{ productId: String, name: String, price: Number, qty: Number }],
  subtotal: Number, tax: Number, shipping: Number, total: Number,
  address: Object, status: { type: String, default: 'PENDING' },
  payment: { id: String, status: String },
  history: [{ status: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true }));

const hdr = (req) => ({ 'x-user-id': req.headers['x-user-id'], 'x-user-role': req.headers['x-user-role'], 'x-user-email': req.headers['x-user-email'], 'Content-Type': 'application/json' });
const adminOnly = (req, res, next) => req.headers['x-user-role'] === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });
const app = express();
app.use(express.json());
app.get('/health', (_q, r) => r.json({ status: 'UP' }));

app.post('/api/orders/checkout', async (req, res) => {
  const userId = req.headers['x-user-id'];
  try {
    const cart = await (await fetch(`${CART_URL}/api/cart`, { headers: hdr(req) })).json();
    if (!cart.items || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    const order = await Order.create({
      userId, userEmail: req.headers['x-user-email'], items: cart.items.map(({ productId, name, price, qty }) => ({ productId, name, price, qty })),
      subtotal: cart.subtotal, tax: cart.tax, shipping: cart.shipping, total: cart.total,
      address: req.body.address || {}, status: 'PENDING', history: [{ status: 'PENDING' }],
    });
    // 1) Payment (AWS Lambda in production)
    const pr = await fetch(`${PAYMENT_URL}/api/payments/process`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: String(order._id), amount: order.total, cardNumber: (req.body.payment || {}).cardNumber }) });
    const pay = await pr.json();
    order.payment = { id: pay.paymentId, status: pay.status };
    if (pay.status !== 'APPROVED') { await order.save(); return res.status(402).json({ error: 'Payment declined', order }); }
    order.status = 'PAID'; order.history.push({ status: 'PAID' }); await order.save();
    // 2) Notification (AWS Lambda) - best effort, never blocks the order
    fetch(`${NOTIFICATION_URL}/api/notifications/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: order.userEmail, type: 'ORDER_CONFIRMED', orderId: String(order._id), total: order.total }) }).catch(() => {});
    // 3) Clear cart
    await fetch(`${CART_URL}/api/cart`, { method: 'DELETE', headers: hdr(req) }).catch(() => {});
    res.status(201).json(order);
  } catch (e) { res.status(502).json({ error: 'Checkout failed: ' + e.message }); }
});

app.get('/api/orders/stats', adminOnly, async (_q, res) => {
  const all = await Order.find({}, 'status total');
  const byStatus = {}; let revenue = 0;
  for (const o of all) { byStatus[o.status] = (byStatus[o.status] || 0) + 1; if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status)) revenue += o.total; }
  res.json({ totalOrders: all.length, revenue: Math.round(revenue * 100) / 100, byStatus });
});
app.get('/api/orders', async (req, res) => {
  const f = req.headers['x-user-role'] === 'admin' && req.query.all === 'true' ? {} : { userId: req.headers['x-user-id'] };
  res.json(await Order.find(f).sort({ createdAt: -1 }));
});
app.get('/api/orders/:id', async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    if (o.userId !== req.headers['x-user-id'] && req.headers['x-user-role'] !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    res.json(o);
  } catch { res.status(400).json({ error: 'Bad id' }); }
});
app.patch('/api/orders/:id/status', adminOnly, async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    const next = req.body.status;
    if (!TRANSITIONS[o.status].includes(next)) return res.status(409).json({ error: `Cannot go ${o.status} -> ${next}`, allowed: TRANSITIONS[o.status] });
    o.status = next; o.history.push({ status: next }); await o.save();
    fetch(`${NOTIFICATION_URL}/api/notifications/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: o.userEmail, type: 'ORDER_' + next, orderId: String(o._id) }) }).catch(() => {});
    res.json(o);
  } catch { res.status(400).json({ error: 'Bad id' }); }
});

app.listen(PORT, () => console.log(`[order] listening on :${PORT}`));
(async () => {
  try { await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000, dbName: 'orders_db' }); }
  catch (e) { console.error('[order] MongoDB connection failed:', e.message); }
})();
