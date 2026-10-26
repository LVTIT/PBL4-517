import { randomBytes, randomUUID } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { config } from '../lib/config.js';
import { prisma, closeDatabase } from '../lib/database.js';

class LabInputError extends Error {}

// Additive synthetic fixtures: never resets the existing catalog or accounts.
// A new output path creates a fresh run; keep the same manifest for before/after.
async function main() {
  const [option, output] = process.argv.slice(2);
  if (!['--output', '--reset-order'].includes(option ?? '') || !output || process.argv.length !== 4) throw new LabInputError('Usage: node dist/scripts/lab-fixtures.js --output|--reset-order PRIVATE_MANIFEST.json');
  if (config.APP_PROFILE !== 'lab' || config.LAB_DATA_ACK !== 'synthetic-only') throw new LabInputError('Requires acknowledged lab profile.');
  if (!/(?:^|[_-])lab(?:$|[_-])/i.test(new URL(config.DATABASE_URL).pathname.slice(1))) throw new LabInputError('Use a dedicated database with a lab name segment, e.g. kevilo_lab.');
  if (option === '--reset-order') {
    const fixture = JSON.parse(await readFile(output, 'utf8'));
    if (fixture.schema !== 1 || !/^[a-f0-9-]{36}$/.test(fixture.run)) throw new LabInputError('Invalid fixture manifest.');
    await prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { id: fixture.orderId }, include: { user: true, items: { include: { product: true } } } });
      const item = order?.items[0];
      if (!order || order.userId !== fixture.owner.id || order.user?.email !== `owner-${fixture.run}@example.invalid`
        || order.items.length !== 1 || !item || item.productId !== fixture.productId || item.quantity !== 2
        || item.product.name !== `KEVILO lab ${fixture.run}` || !['PENDING', 'CANCELLED'].includes(order.status)) {
        throw new LabInputError('Fixture ownership/content changed; refusing reset.');
      }
      if (order.status === 'CANCELLED') {
        const changed = await tx.product.updateMany({ where: { id: fixture.productId, stock: { gte: 2 } }, data: { stock: { decrement: 2 } } });
        if (changed.count !== 1) throw new LabInputError('Insufficient fixture stock to restore pending order.');
      }
      await tx.order.update({ where: { id: order.id }, data: { status: 'PENDING', shippingAddress: 'Synthetic owner address', customerPhone: null } });
    }, { isolationLevel: 'Serializable' });
    console.log('Reset only the verified synthetic order; persisted XSS review retained.');
    return;
  }
  const file = await open(output, 'wx', 0o600); // Refuse to overwrite evidence/credentials.
  let committed = false;
  try {
    const run = randomUUID();
    const password = randomBytes(24).toString('base64url') + '!aA1';
    const hash = await bcrypt.hash(password, 12);
    const manifest = await prisma.$transaction(async tx => {
      const people = [];
      for (const role of ['owner', 'attacker', 'admin']) {
        const user = await tx.user.create({ data: { email: `${role}-${run}@example.invalid`, name: `Lab ${role}`, passwordHash: hash, role: role === 'admin' ? 'ADMIN' : 'CUSTOMER' } });
        people.push({ id: user.id, email: user.email, password });
      }
      const product = await tx.product.create({ data: { name: `KEVILO lab ${run}`, description: 'Synthetic security demo fixture', category: 'Lab', stock: 48, price: '1000.00' } });
      const owner = people[0]!;
      const order = await tx.order.create({ data: { userId: owner.id, customerName: 'Lab owner', customerEmail: owner.email,
        shippingAddress: 'Synthetic owner address', totalPrice: '2000.00',
        items: { create: [{ productId: product.id, quantity: 2, unitPrice: '1000.00' }] } } });
      // Persist one harmless marker once; do not delete it between XSS phases.
      const payload = '<img src="/missing-pbl517-probe" onerror="window.__pbl517_xss_probe=1">';
      const review = await tx.review.create({ data: { userId: owner.id, productId: product.id, rating: 5, comment: payload } });
      const result = { schema: 1, run, owner, attacker: people[1]!, admin: people[2]!, productId: product.id, productName: product.name, orderId: order.id, reviewId: review.id, xssPayload: payload };
      await file.writeFile(JSON.stringify(result, null, 2) + '\n');
      await file.sync();
      return result;
    });
    committed = true;
    console.log(`Created synthetic run ${manifest.run}. Private manifest written; do not commit or publish it.`);
  } finally {
    await file.close();
    if (!committed) await unlink(output);
  }
}
try { await main(); }
catch (error) { console.error(error instanceof LabInputError ? error.message : 'Fixture creation failed; inspect private database logs.'); process.exitCode = 1; }
finally { await closeDatabase(); }
