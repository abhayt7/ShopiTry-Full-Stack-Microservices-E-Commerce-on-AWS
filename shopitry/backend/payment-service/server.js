// Local Express wrapper around the Lambda handler (port 5004).
const path = require('path');
require('dotenv').config(); require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const { processPayment } = require('./handler');
const app = express(); app.use(express.json());
app.get('/health', (_q, r) => r.json({ status: 'UP' }));
app.post('/api/payments/process', (req, res) => { const r = processPayment(req.body); res.status(r.statusCode).json(r.payload); });
const PORT = process.env.PAYMENT_PORT || 5004;
app.listen(PORT, () => console.log(`[payment] listening on :${PORT}`));
