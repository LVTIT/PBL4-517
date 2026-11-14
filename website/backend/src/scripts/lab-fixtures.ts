import { randomBytes, randomUUID } from 'node:crypto';
import { open, readFile, unlink, writeFile, rename, copyFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { config } from '../lib/config.js';
import { prisma, closeDatabase } from '../lib/database.js';

class LabInputError extends Error {}

// Additive synthetic fixtures: never resets the existing catalog or accounts.
// A new output path creates a fresh run; keep the same manifest for before/after.
async function main() {
  const [option, output] = process.argv.slice(2);
  if (!['--output', '--reset-order', '--local-accounts'].includes(option ?? '') || !output || process.argv.length !== 4) throw new LabInputError('Usage: node dist/scripts/lab-fixtures.js --output|--reset-order|--local-accounts PRIVATE_MANIFEST.json');
  if (config.APP_PROFILE !== 'lab' || config.LAB_DATA_ACK !== 'synthetic-only') throw new LabInputError('Requires acknowledged lab profile.');
  if (!/(?:^|[_-])lab(?:$|[_-])/i.test(new URL(config.DATABASE_URL).pathname.slice(1))) throw new LabInputError('Use a dedicated database with a lab name segment, e.g. kevilo_lab.');
  const databaseUrl = new URL(config.DATABASE_URL);
  const localDatabase = config.NODE_ENV === 'development'
    && ['127.0.0.1', 'localhost', '[::1]'].includes(databaseUrl.hostname)
    && databaseUrl.pathname === '/kevilo_local_lab';
  if (option === '--local-accounts') {
    if (!localDatabase) throw new LabInputError('Memorable accounts are restricted to development loopback kevilo_local_lab.');
    const fixture = JSON.parse(await readFile(output, 'utf8'));
    if (fixture.schema !== 1 || !/^[a-f0-9-]{36}$/.test(fixture.run)) throw new LabInputError('Invalid fixture manifest.');
    const names = ['owner', 'attacker', 'admin'] as const;
    const passwords = { owner: 'Owner517!demo', attacker: 'Attacker517!demo', admin: 'Admin517!demo' };
    const changed = structuredClone(fixture);
    const hashes = Object.fromEntries(await Promise.all(names.map(async name => [name, await bcrypt.hash(passwords[name], 12)])));
    const temporary = output + '.pending-local';
    if (!fixture.localAccounts) await copyFile(output, output + '.before-local-' + Date.now());
    try {
      await prisma.$transaction(async tx => {
        const product = await tx.product.findUnique({ where: { id: fixture.productId } });
        const order = await tx.order.findUnique({ where: { id: fixture.orderId } });
        if (product?.name !== `KEVILO lab ${fixture.run}` || order?.userId !== fixture.owner.id) throw new LabInputError('Fixture binding changed; no accounts modified.');
        for (const name of names) {
          const email = `${name}@local.test`;
          const user = await tx.user.findUnique({ where: { id: fixture[name].id } });
          const collision = await tx.user.findUnique({ where: { email } });
          if (!user || ![`${name}-${fixture.run}@example.invalid`, email].includes(user.email)
            || user.role !== (name === 'admin' ? 'ADMIN' : 'CUSTOMER')
            || (collision && collision.id !== user.id)) throw new LabInputError('Local account name collision or fixture mismatch; no accounts overwritten.');
          if (fixture.localAccounts) {
            if (fixture[name].email !== email || !await bcrypt.compare(fixture[name].password, user.passwordHash)) throw new LabInputError('Local manifest and account differ; inspect private backup instead of resetting passwords.');
          } else {
            await tx.user.update({ where: { id: user.id }, data: { email, name: `Lab ${name}`, passwordHash: hashes[name]! } });
            changed[name] = { id: user.id, email, password: passwords[name] };
          }
        }
        if (!fixture.localAccounts) {
          await tx.order.update({ where: { id: fixture.orderId }, data: { customerEmail: 'owner@local.test' } });
          await tx.$executeRaw`DELETE FROM "session" WHERE sess->>'userId' IN (${fixture.owner.id}, ${fixture.attacker.id}, ${fixture.admin.id})`;
          changed.localAccounts = true;
          await writeFile(temporary, JSON.stringify(changed, null, 2) + '\n', { mode: 0o600 });
        }
      }, { isolationLevel: 'Serializable', timeout: 15000 });
      if (!fixture.localAccounts) await rename(temporary, output);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
    console.log('Local accounts verified: owner@local.test, attacker@local.test, admin@local.test. IDs/order/review retained; credentials in the private manifest.');
    return;
  }
  if (option === '--reset-order') {
    const fixture = JSON.parse(await readFile(output, 'utf8'));
    if (fixture.schema !== 1 || !/^[a-f0-9-]{36}$/.test(fixture.run)) throw new LabInputError('Invalid fixture manifest.');
    await prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { id: fixture.orderId }, include: { user: true, items: { include: { product: true } } } });
      const item = order?.items[0];
      const expectedEmail = fixture.localAccounts && localDatabase ? 'owner@local.test' : `owner-${fixture.run}@example.invalid`;
      if (!order || order.userId !== fixture.owner.id || order.user?.email !== expectedEmail || fixture.owner.email !== expectedEmail
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
