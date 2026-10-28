const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const mongoose = require('mongoose');
const PORT = process.env.CATALOG_PORT || 5001;

const Product = mongoose.model('Product', new mongoose.Schema({
  name: { type: String, required: true }, description: String, category: String,
  price: { type: Number, required: true, min: 0 }, stock: { type: Number, default: 0 },
  image: String, specs: { type: Object, default: {} },
}, { timestamps: true }));

const adminOnly = (req, res, next) => req.headers['x-user-role'] === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });
const app = express();
app.use(express.json());
app.get('/health', (_q, r) => r.json({ status: 'UP' }));

app.get('/api/catalog/products', async (req, res) => {
  const { q, category } = req.query; const f = {};
  if (category && category !== 'All') f.category = category;
  if (q) f.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  res.json(await Product.find(f).sort({ createdAt: -1 }));
});
app.get('/api/catalog/categories', async (_q, r) => r.json(['All', ...(await Product.distinct('category'))]));
app.get('/api/catalog/products/:id', async (req, res) => {
  try { const p = await Product.findById(req.params.id); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); }
  catch { res.status(400).json({ error: 'Bad id' }); }
});
app.post('/api/catalog/products', adminOnly, async (req, res) => {
  try { res.status(201).json(await Product.create(req.body)); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/catalog/products/:id', adminOnly, async (req, res) => {
  try { const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/catalog/products/:id', adminOnly, async (req, res) => {
  try { await Product.findByIdAndDelete(req.params.id); res.json({ deleted: true }); } catch { res.status(400).json({ error: 'Bad id' }); }
});

const SEED = [
  ['Aero Wireless Headphones', 'Audio', 129.99, 40, { Battery: '30h', Bluetooth: '5.3', ANC: 'Yes' }],
  ['Pulse Smart Watch', 'Wearables', 199.0, 25, { Display: 'AMOLED', Battery: '7 days', GPS: 'Yes' }],
  ['Nimbus Mechanical Keyboard', 'Accessories', 89.5, 60, { Switches: 'Brown', Layout: '75%', Backlight: 'RGB' }],
  ['Vertex 4K Monitor 27"', 'Displays', 349.0, 15, { Resolution: '3840x2160', Refresh: '144Hz', Panel: 'IPS' }],
  ['Orbit Ergonomic Mouse', 'Accessories', 49.99, 100, { DPI: '16000', Buttons: '7', Wireless: 'Yes' }],
  ['Echo Portable Speaker', 'Audio', 59.0, 80, { Battery: '12h', Waterproof: 'IP67' }],
  ['Lumen USB-C Hub 8-in-1', 'Accessories', 39.9, 120, { Ports: '8', HDMI: '4K@60', PD: '100W' }],
  ['Halo Fitness Band', 'Wearables', 45.0, 70, { Battery: '14 days', Sensors: 'HR, SpO2' }],
].map(([name, category, price, stock, specs]) => ({ name, category, price, stock, specs, description: `${name} - quality gear for everyday use.`, image: '' }));

app.listen(PORT, () => console.log(`[catalog] listening on :${PORT}`));
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5000, dbName: 'catalog_db' });
    if ((await Product.countDocuments()) === 0) { await Product.insertMany(SEED); console.log('[catalog] seeded products'); }
  } catch (e) { console.error('[catalog] MongoDB connection failed:', e.message); }
})();
