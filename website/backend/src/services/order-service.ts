import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/database.js';
import { AppError, databaseUnavailable } from '../lib/errors.js';
import type { OrderStatus } from '../generated/prisma/client.js';

function isIdorVulnerable(): boolean {
  try {
    const envFile = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      const match = content.match(/^\s*VULN_IDOR_ENABLED\s*=\s*(true|false)/m);
      if (match) return match[1] === 'true';
    }
  } catch {
    // Fallback
  }
  return process.env.VULN_IDOR_ENABLED === 'true';
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface GuestInfoInput {
  name: string;
  email: string;
  phone?: string;
}

export async function createOrder(
  items: CartItemInput[],
  shippingAddress: string,
  userId?: string | null,
  guestInfo?: GuestInfoInput
) {
  if (!items || items.length === 0) {
    throw new AppError(400, 'EMPTY_CART', 'Giỏ hàng của bạn đang trống.');
  }

  let customerName = guestInfo?.name?.trim();
  let customerEmail = guestInfo?.email?.trim();
  let customerPhone = guestInfo?.phone?.trim() || null;

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => {
      throw databaseUnavailable();
    });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Tài khoản người dùng không tồn tại.');
    }
    // RBAC: Admins are strictly managers; only customers and guests can place orders
    if (user.role === 'ADMIN') {
      throw new AppError(
        403,
        'ADMIN_CANNOT_ORDER',
        'Tài khoản Quản trị viên chỉ dành cho việc quản lý hệ thống. Vui lòng đăng xuất hoặc dùng tài khoản Khách hàng để mua sắm.'
      );
    }
    customerName = user.name;
    customerEmail = user.email;
  } else {
    // Guest checkout requires contact info
    if (!customerName || !customerEmail) {
      throw new AppError(400, 'GUEST_INFO_REQUIRED', 'Khách vãng lai vui lòng cung cấp họ tên và email nhận đơn hàng.');
    }
  }

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  }).catch(() => {
    throw databaseUnavailable();
  });

  if (products.length !== productIds.length) {
    throw new AppError(400, 'INVALID_PRODUCT', 'Một số sản phẩm trong đơn hàng không tồn tại.');
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  let totalPrice = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    if (item.quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', `Số lượng sản phẩm ${product.name} không hợp lệ.`);
    }
    if (product.stock < item.quantity) {
      throw new AppError(400, 'OUT_OF_STOCK', `Sản phẩm "${product.name}" chỉ còn ${product.stock} trong kho.`);
    }
    totalPrice += Number(product.price) * item.quantity;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Decrement stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 2. Create Order & OrderItems
      const created = await tx.order.create({
        data: {
          userId: userId ?? null,
          customerName: customerName ?? null,
          customerEmail: customerEmail ?? null,
          customerPhone: customerPhone ?? null,
          totalPrice: totalPrice.toFixed(2),
          shippingAddress,
          items: {
            create: items.map((item) => {
              const product = productMap.get(item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });

      return {
        ...created,
        totalPrice: Number(created.totalPrice).toFixed(2),
        items: created.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice).toFixed(2) })),
      };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw databaseUnavailable();
  }
}

export async function getUserOrders(userId: string) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => ({
      ...o,
      totalPrice: o.totalPrice.toFixed(2),
      items: o.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toFixed(2) })),
    }));
  } catch {
    throw databaseUnavailable();
  }
}

export async function getAllOrders() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => ({
      ...o,
      totalPrice: o.totalPrice.toFixed(2),
      items: o.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toFixed(2) })),
    }));
  } catch {
    throw databaseUnavailable();
  }
}

export async function getOrderById(orderId: string, requestingUserId: string, isAdmin: boolean) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
    }

    // IDOR Protection: Enabled by default (Secure Baseline).
    // Can be toggled via VULN_IDOR_ENABLED=true in .env for OWASP Lab Demonstration.
    if (!isIdorVulnerable() && order.userId !== requestingUserId && !isAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền xem thông tin đơn hàng này.');
    }

    return {
      ...order,
      totalPrice: order.totalPrice.toFixed(2),
      items: order.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toFixed(2) })),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw databaseUnavailable();
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
    return { ...order, totalPrice: order.totalPrice.toFixed(2) };
  } catch {
    throw databaseUnavailable();
  }
}
