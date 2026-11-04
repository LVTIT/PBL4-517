import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '../dist/generated/prisma/client.js';
import { AppError, databaseUnavailable } from '../dist/lib/errors.js';
import { translatePrismaError, rethrowDataError } from '../dist/lib/data-errors.js';

const known = (code, meta = {}) => new Prisma.PrismaClientKnownRequestError(
  'PRIVATE postgres://user:secret@db.internal Product_column_key SELECT /private/prisma stack',
  { code, clientVersion: '7.10.0', meta },
);
const shape = error => ({ status: error.status, code: error.code, message: error.message });
const mapped = [
  ['P2002', {}, 'default', 409, 'CONFLICT', 'Dữ liệu đã tồn tại.'],
  ['P2002', { modelName: 'User', target: ['email'] }, 'register-email-conflict', 409, 'EMAIL_EXISTS', 'Email này đã được sử dụng. Vui lòng chọn email khác.'],
  ['P2002', { modelName: 'User', target: ['id'] }, 'default', 409, 'CONFLICT', 'Dữ liệu đã tồn tại.'],
  ['P2002', { modelName: 'Other', target: ['email'] }, 'register-email-conflict', 409, 'CONFLICT', 'Dữ liệu đã tồn tại.'],
  ['P2002', { modelName: 'User', target: 'User_email_key' }, 'default', 409, 'CONFLICT', 'Dữ liệu đã tồn tại.'],
  ...['update-product', 'delete-product'].map(operation =>
    ['P2025', { modelName: 'Product' }, operation, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu yêu cầu.']),
  ['P2003', { modelName: 'Product' }, 'delete-product', 409, 'CONFLICT', 'Dữ liệu đang được tham chiếu ở nơi khác nên không thể thay đổi hoặc xoá.'],
];
for (const [code, meta, operation, status, apiCode, message] of mapped) {
  test(`mapping ${code} ${operation} ${JSON.stringify(meta)}`, () => {
    const input = known(code, meta);
    const expected = { status, code: apiCode, message };
    assert.deepEqual(shape(translatePrismaError(input, operation)), expected);
    assert.throws(() => rethrowDataError(input, operation), error => {
      assert.deepEqual(shape(error), expected);
      return true;
    });
  });
}

for (const code of ['P2000', 'P2001', 'P2004', 'P2007', 'P2015', 'P2018', 'P2023', 'P2025', 'P2003', 'P2034', 'P9999']) {
  test(`unsafe/unmapped ${code} stays 503 in every unrelated context`, () => {
    for (const operation of ['default', 'register-email-conflict', 'update-product', 'delete-product']) {
      assert.deepEqual(shape(translatePrismaError(known(code, { modelName: 'Order' }), operation)), shape(databaseUnavailable()));
    }
  });
}

test('Product P2025/P2003 require the specific operation, not just the model', () => {
  for (const code of ['P2025', 'P2003']) {
    assert.deepEqual(shape(translatePrismaError(known(code, { modelName: 'Product' }))), shape(databaseUnavailable()));
  }
  assert.deepEqual(shape(translatePrismaError(known('P2003', { modelName: 'Product' }), 'update-product')), shape(databaseUnavailable()));
});

test('unknown non-Prisma failures and forged code objects stay 503', () => {
  for (const error of [new Error('probe'), null, undefined, { code: 'P2002' },
    new Prisma.PrismaClientValidationError('private details', { clientVersion: '7.10.0' })]) {
    assert.deepEqual(shape(translatePrismaError(error)), shape(databaseUnavailable()));
  }
});

for (const [status, code] of [[400, 'OUT_OF_STOCK'], [400, 'CANNOT_CANCEL'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'INVALID_STATUS_TRANSITION']]) {
  test(`AppError passthrough preserves object identity: ${code}`, () => {
    const error = new AppError(status, code, 'safe domain message');
    for (const operation of ['default', 'register-email-conflict', 'update-product', 'delete-product']) {
      assert.strictEqual(translatePrismaError(error, operation), error);
      assert.throws(() => rethrowDataError(error, operation), actual => actual === error);
    }
  });
}
