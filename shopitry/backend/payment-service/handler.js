// Lambda-compatible handler. Deploy this file as the Lambda function (handler: handler.handler).
// Simulated gateway: any card ending in 0002 is declined, everything else is approved.
const crypto = require('crypto');
function processPayment(body) {
  const { orderId, amount, cardNumber = '4242424242424242' } = body || {};
  if (!orderId || !(amount > 0)) return { statusCode: 400, payload: { error: 'orderId and positive amount required' } };
  const declined = String(cardNumber).replace(/\s/g, '').endsWith('0002');
  return { statusCode: 200, payload: { paymentId: 'pay_' + crypto.randomBytes(6).toString('hex'), orderId, amount, status: declined ? 'DECLINED' : 'APPROVED' } };
}
exports.processPayment = processPayment;
exports.handler = async (event) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || event;
  const r = processPayment(body);
  return { statusCode: r.statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.payload) };
};
