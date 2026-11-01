// Reproduction C: the admin status endpoint can resurrect a CANCELLED order,
// so customer cancel -> admin reopen -> customer cancel restocks the same units twice.
const baseUrl = process.env.TEST_API_URL ?? 'http://127.0.0.1:3062';

class Session {
  cookie = '';
  async request(path, { method = 'GET', body, csrfToken } = {}) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      if (cookie.startsWith('pbl517.sid=')) this.cookie = cookie.split(';')[0];
    }
    return { status: response.status, body: await response.json() };
  }
  async csrf() { return (await this.request('/auth/csrf')).body.data.csrfToken; }
  async login(email, password) {
    const csrfToken = await this.csrf();
    const r = await this.request('/auth/login', { method: 'POST', csrfToken, body: { email, password } });
    if (r.status !== 200) throw new Error(`login failed ${r.status}`);
    return this.csrf();
  }
}

const admin = new Session();
const adminCsrf = await admin.login('admin@example.com', 'AdminOnly517!');
const customer = new Session();
let customerCsrf = await customer.login('demo@example.com', 'DemoOnly517!');
const stockOf = async (id) => (await customer.request(`/products/${id}`)).body.data.stock;

const product = (await customer.request('/products')).body.data.find((p) => p.stock >= 4);
const before = await stockOf(product.id);

const order = await customer.request('/orders', {
  method: 'POST', csrfToken: customerCsrf,
  body: { items: [{ productId: product.id, quantity: 2 }], shippingAddress: 'Dia chi kiem thu 789' },
});
const orderId = order.body.data.id;
const afterOrder = await stockOf(product.id);

const rounds = [];
for (let round = 1; round <= 3; round += 1) {
  customerCsrf = await customer.csrf();
  const cancel = await customer.request(`/orders/${orderId}/cancel`, { method: 'POST', csrfToken: customerCsrf });
  const afterCancel = await stockOf(product.id);
  const reopen = await admin.request(`/admin/orders/${orderId}/status`, {
    method: 'PATCH', csrfToken: adminCsrf, body: { status: 'PENDING' },
  });
  const afterReopen = await stockOf(product.id);
  rounds.push({ round, cancelStatus: cancel.status, afterCancel, reopenStatus: reopen.status, afterReopen });
}

const final = await stockOf(product.id);
console.log(JSON.stringify({
  product: product.id,
  stockBefore: before, stockAfterOrder: afterOrder, rounds, finalStock: final,
  phantomUnits: final - before,
  expectedFinalStock: before,
}, null, 2));
