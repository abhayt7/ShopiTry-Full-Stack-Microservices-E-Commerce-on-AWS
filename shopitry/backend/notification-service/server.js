const path = require('path');
require('dotenv').config(); require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const { send } = require('./handler');
const app = express(); app.use(express.json());
app.get('/health', (_q, r) => r.json({ status: 'UP' }));
app.post('/api/notifications/send', (req, res) => { const r = send(req.body); res.status(r.statusCode).json(r.payload); });
const PORT = process.env.NOTIFICATION_PORT || 5005;
app.listen(PORT, () => console.log(`[notification] listening on :${PORT}`));
