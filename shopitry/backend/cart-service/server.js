const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const mongoose = require('mongoose');
const PORT = process.env.CART_PORT || 5002;
const CATALOG_URL = process.env.CATALOG_URL || 'http://localhost:5001';
const TAX_RATE = 0.08, FREE_SHIPPING_OVER = 100, SHIPPING_FEE = 9.99;

const Cart = mongoose.model('Cart', new mongoose.Schema({
  userId: { type: String, unique: true, index: true },
  items: [{ productId: String, name: String, price: Number, qty: Number, image: String }],
}, { timestamps: true }));

const r2 = (n) => Math.round(n * 100) / 100;
const view = (cart) => {
  const items = cart ? cart.items : [];
  const subtotal = r2(items.reduce((s, i) => s + i.price * i.qty, 0));
  const tax = r2(subtotal * TAX_RATE);
  const shipping = items.length === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  return { items, subtotal, tax, shipping, total: r2(subtotal + tax + shipping) };
};
const needUser = (req, res, next) => req.headers['x-user-id'] ? next() : res.status(401).json({ error: 'Missing user' });

const app = express();
app.use(express.json());
app.get('/health', (_q, r) => r.json({ status: 'UP' }));
app.use('/api/cart', needUser);

app.get('/api/cart', async (req, res) => res.json(view(await Cart.findOne({ userId: req.headers['x-user-id'] }))));

app.post('/api/cart/items', async (req, res) => {
  const { productId, qty = 1 } = req.body || {};
  if (!productId || qty < 1) return res.status(400).json({ error: 'productId and qty>=1 required' });
  let product;
  try {
    const r = await fetch(`${CATALOG_URL}/api/catalog/products/${productId}`);
    if (!r.ok) return res.status(404).json({ error: 'Product not found' });
    product = await r.json();
  } catch { return res.status(502).json({ error: 'Catalog unavailable' }); }
  const userId = req.headers['x-user-id'];
  const cart = (await Cart.findOne({ userId })) || new Cart({ userId, items: [] });
  const line = cart.items.find((i) => i.productId === productId);
  const newQty = (line ? line.qty : 0) + qty;
  if (newQty > product.stock) return res.status(409).json({ error: `Only ${product.stock} in stock` });
  if (line) line.qty = newQty; else cart.items.push({ productId, name: product.name, price: product.price, qty, image: product.image });
  await cart.save(); res.json(view(cart));
});
app.patch('/api/cart/items/:productId', async (req, res) => {
  const cart = await Cart.findOne({ userId: req.headers['x-user-id'] });
  if (!cart) return res.json(view(null));
  const line = cart.items.find((i) => i.productId === req.params.productId);
  if (line) { line.qty = Math.max(1, Number(req.body.qty) || 1); await cart.save(); }
  res.json(view(cart));
});
app.delete('/api/cart/items/:productId', async (req, res) => {
  const cart = await Cart.findOne({ userId: req.headers['x-user-id'] });
  if (cart) { cart.items = cart.items.filter((i) => i.productId !== req.params.productId); await cart.save(); }
  res.json(view(cart));
});
app.delete('/api/cart', async (req, res) => { await Cart.deleteOne({ userId: req.headers['x-user-id'] }); res.json(view(null)); });

app.listen(PORT, () => console.log(`[cart] listening on :${PORT}`));
(async () => {
  try { await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000, dbName: 'cart_db' }); }
  catch (e) { console.error('[cart] MongoDB connection failed:', e.message); }
})();
