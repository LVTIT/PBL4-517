// Reproduction for the admin status-change inventory bug (variant B).
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
const customerCsrf = await customer.login('demo@example.com', 'DemoOnly517!');

const stockOf = async (id) => (await customer.request(`/products/${id}`)).body.data.stock;
const product = (await customer.request('/products')).body.data.find((p) => p.stock >= 6);
const before = await stockOf(product.id);

const order = await customer.request('/orders', {
  method: 'POST', csrfToken: customerCsrf,
  body: { items: [{ productId: product.id, quantity: 3 }], shippingAddress: 'Dia chi kiem thu 456' },
});
const orderId = order.body.data.id;
const afterOrder = await stockOf(product.id);

// Admin cancels a PENDING order. Stock was decremented on create; a cancellation
// must give it back, exactly as the customer path does.
const adminCancel = await admin.request(`/admin/orders/${orderId}/status`, {
  method: 'PATCH', csrfToken: adminCsrf, body: { status: 'CANCELLED' },
});
const afterAdminCancel = await stockOf(product.id);

// Then the admin walks the same cancelled order forward again.
const backToPending = await admin.request(`/admin/orders/${orderId}/status`, {
  method: 'PATCH', csrfToken: adminCsrf, body: { status: 'PENDING' },
});
const afterBackToPending = await stockOf(product.id);

// And cancels it a second time.
const adminCancelAgain = await admin.request(`/admin/orders/${orderId}/status`, {
  method: 'PATCH', csrfToken: adminCsrf, body: { status: 'CANCELLED' },
});
const afterSecondCancel = await stockOf(product.id);

console.log(JSON.stringify({
  product: product.id,
  stockBefore: before,
  stockAfterOrder: afterOrder,
  adminCancel: { status: adminCancel.status, stock: afterAdminCancel },
  backToPending: { status: backToPending.status, stock: afterBackToPending },
  adminCancelAgain: { status: adminCancelAgain.status, stock: afterSecondCancel },
  expectedAfterAdminCancel: before,
  leakedUnits: before - afterAdminCancel,
  driftAfterReplay: afterSecondCancel - before,
}, null, 2));
