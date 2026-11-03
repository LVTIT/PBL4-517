// Reproduction for the admin status-change inventory bug.
// Run from website/backend with a started backend and a seeded development database.
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
  async csrf() {
    const result = await this.request('/auth/csrf');
    return result.body.data.csrfToken;
  }
  async login(email, password) {
    const csrfToken = await this.csrf();
    const result = await this.request('/auth/login', { method: 'POST', csrfToken, body: { email, password } });
    if (result.status !== 200) throw new Error(`login failed ${result.status}`);
    return this.csrf();
  }
}

const admin = new Session();
const adminCsrf = await admin.login('admin@example.com', 'AdminOnly517!');
const customer = new Session();
const customerCsrf = await customer.login('demo@example.com', 'DemoOnly517!');

const product = (await customer.request('/products')).body.data.find((p) => p.stock >= 5);
const stockBefore = (await customer.request(`/products/${product.id}`)).body.data.stock;

const order = await customer.request('/orders', {
  method: 'POST', csrfToken: customerCsrf,
  body: { items: [{ productId: product.id, quantity: 2 }], shippingAddress: 'Dia chi kiem thu 123' },
});
const stockAfterOrder = (await customer.request(`/products/${product.id}`)).body.data.stock;

// Step 1: customer cancels the order — stock must come back exactly once.
const cancel = await customer.request(`/orders/${order.body.data.id}/cancel`, { method: 'POST', csrfToken: customerCsrf });
const stockAfterCancel = (await customer.request(`/products/${product.id}`)).body.data.stock;

// Step 2: admin flips the same (already cancelled) order back to CONFIRMED.
const reconfirm = await admin.request(`/admin/orders/${order.body.data.id}/status`, {
  method: 'PATCH', csrfToken: adminCsrf, body: { status: 'CONFIRMED' },
});
const stockAfterReconfirm = (await customer.request(`/products/${product.id}`)).body.data.stock;

// Step 3: admin moves CONFIRMED -> CANCELLED. This is the ambiguous transition:
// did an admin cancellation already release the units?
const adminCancel = await admin.request(`/admin/orders/${order.body.data.id}/status`, {
  method: 'PATCH', csrfToken: adminCsrf, body: { status: 'CANCELLED' },
});
const stockAfterAdminCancel = (await customer.request(`/products/${product.id}`)).body.data.stock;

// Step 4: a second admin cancellation of the same order.
const adminCancelTwice = await admin.request(`/admin/orders/${order.body.data.id}/status`, {
  method: 'PATCH', csrfToken: adminCsrf, body: { status: 'CANCELLED' },
});
const stockAfterAdminCancelTwice = (await customer.request(`/products/${product.id}`)).body.data.stock;

console.log(JSON.stringify({
  product: product.id,
  stockBefore,
  stockAfterOrder,
  stockAfterCustomerCancel: { status: cancel.status, stock: stockAfterCancel },
  reconfirm: { status: reconfirm.status, stock: stockAfterReconfirm },
  adminCancel: { status: adminCancel.status, stock: stockAfterAdminCancel },
  adminCancelTwice: { status: adminCancelTwice.status, stock: stockAfterAdminCancelTwice },
  phantomUnits: stockAfterAdminCancelTwice - stockAfterCancel,
}, null, 2));
