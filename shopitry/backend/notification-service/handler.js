// Lambda-compatible handler. Currently logs the email; swap the console.log for
// AWS SES (email) / SNS (event alerts) SDK calls when deploying for real.
function send(body) {
  const { to, type, orderId, total } = body || {};
  if (!to || !type) return { statusCode: 400, payload: { error: 'to and type required' } };
  console.log(`[notification] ${type} -> ${to} (order ${orderId}${total ? ', total ' + total : ''})`);
  return { statusCode: 200, payload: { sent: true, to, type } };
}
exports.send = send;
exports.handler = async (event) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || event;
  const r = send(body);
  return { statusCode: r.statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.payload) };
};
