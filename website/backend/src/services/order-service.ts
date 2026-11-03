import { config } from '../lib/config.js';
import { prisma } from '../lib/database.js';
import { AppError, databaseUnavailable } from '../lib/errors.js';
import type { OrderStatus } from '../generated/prisma/client.js';

function isIdorVulnerable(): boolean {
  return config.VULN_IDOR_ENABLED === 'true';
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
  guestInfo?: GuestInfoInput,
  recipientPhone?: string
) {
  if (!items || items.length === 0) {
    throw new AppError(400, 'EMPTY_CART', 'Giỏ hàng của bạn đang trống.');
  }

  let customerName = guestInfo?.name?.trim();
  let customerEmail = guestInfo?.email?.trim();
  const customerPhone = recipientPhone?.trim() || guestInfo?.phone?.trim() || null;

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

  if (products.length !== new Set(productIds).size) {
    throw new AppError(400, 'INVALID_PRODUCT', 'Một số sản phẩm trong đơn hàng không tồn tại.');
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Collapse duplicate lines so a repeated product is compared against stock once,
  // not once per line. Without this, two lines of the same product each pass the
  // per-line check while their sum exceeds what is actually available.
  const requestedByProduct = new Map<string, number>();
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    if (item.quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', `Số lượng sản phẩm ${product.name} không hợp lệ.`);
    }
    requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  let totalPrice = 0;
  for (const [productId, quantity] of requestedByProduct) {
    const product = productMap.get(productId)!;
    totalPrice += Number(product.price) * quantity;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Decrement stock conditionally inside the transaction.
      // The guard must live in the same statement that writes, otherwise two
      // concurrent checkouts both read the pre-sale level, both pass, and the
      // trailing CHECK ("stock" >= 0) turns the loser into a 503 instead of a
      // 400 OUT_OF_STOCK.
      for (const [productId, quantity] of requestedByProduct) {
        const product = productMap.get(productId)!;
        const claimed = await tx.product.updateMany({
          where: { id: productId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (claimed.count === 0) {
          const current = await tx.product.findUnique({
            where: { id: productId },
            select: { stock: true, name: true },
          });
          throw new AppError(
            400,
            'OUT_OF_STOCK',
            current && current.stock > 0
              ? `Sản phẩm "${product.name}" chỉ còn ${current.stock} trong kho.`
              : `Sản phẩm "${product.name}" đã hết hàng.`,
          );
        }
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
    // Defense-in-depth: When secure baseline is active, apply query scoping at the database level
    if (!isIdorVulnerable() && !isAdmin) {
      const scopedOrder = await prisma.order.findFirst({
        where: { id: orderId, userId: requestingUserId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (scopedOrder) {
        return {
          ...scopedOrder,
          totalPrice: scopedOrder.totalPrice.toFixed(2),
          items: scopedOrder.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toFixed(2) })),
        };
      }

      // If not found for current user, check if order exists in system to return 403 vs 404
      const orderExists = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true },
      });

      if (orderExists) {
        throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền xem thông tin đơn hàng này.');
      }
      throw new AppError(404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
    }

    // Vulnerable mode (VULN_IDOR_ENABLED=true) or Admin role:
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

export async function updateOrderDetails(
  orderId: string,
  requestingUserId: string,
  isAdmin: boolean,
  data: { shippingAddress?: string; customerPhone?: string }
) {
  try {
    if (!isIdorVulnerable() && !isAdmin) {
      // Defense-in-depth: Database Query Scoping enforced at database level
      const scopedOrder = await prisma.order.findFirst({
        where: { id: orderId, userId: requestingUserId },
        select: { id: true, status: true },
      });

      if (!scopedOrder) {
        const orderExists = await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true },
        });

        if (orderExists) {
          throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền chỉnh sửa đơn hàng này.');
        }
        throw new AppError(404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
      }

      if (scopedOrder.status !== 'PENDING') {
        throw new AppError(400, 'CANNOT_UPDATE', 'Chỉ có thể chỉnh sửa đơn hàng ở trạng thái Chờ xử lý (PENDING).');
      }
    } else {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });

      if (!order) {
        throw new AppError(404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
      }

      if (order.status !== 'PENDING') {
        throw new AppError(400, 'CANNOT_UPDATE', 'Chỉ có thể chỉnh sửa đơn hàng ở trạng thái Chờ xử lý (PENDING).');
      }
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(data.shippingAddress ? { shippingAddress: data.shippingAddress } : {}),
        ...(data.customerPhone !== undefined ? { customerPhone: data.customerPhone } : {}),
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
      ...updated,
      totalPrice: updated.totalPrice.toFixed(2),
      items: updated.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toFixed(2) })),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw databaseUnavailable();
  }
}

export async function cancelOrder(
  orderId: string,
  requestingUserId: string,
  isAdmin: boolean
) {
  try {
    let orderToCancel: { id: string; status: OrderStatus; items: { productId: string; quantity: number }[] } | null;

    // Cancellation is guarded by a scoped read first so that an outsider gets
    // 403 rather than a silent no-op. The authoritative ownership and state
    // check still has to happen inside the writing transaction below.
    if (!isIdorVulnerable() && !isAdmin) {
      // Defense-in-depth: Database Query Scoping enforced at database level
      const scopedOrder = await prisma.order.findFirst({
        where: { id: orderId, userId: requestingUserId },
        select: {
          id: true,
          status: true,
          userId: true,
          items: { select: { productId: true, quantity: true } },
        },
      });

      if (!scopedOrder) {
        const orderExists = await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true },
        });

        if (orderExists) {
          throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền hủy đơn hàng này.');
        }
        throw new AppError(404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
      }
      orderToCancel = scopedOrder;
    } else {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          userId: true,
          items: { select: { productId: true, quantity: true } },
        },
      });

      if (!order) {
        throw new AppError(404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
      }
      orderToCancel = order;
    }

    if (orderToCancel.status !== 'PENDING') {
      throw new AppError(400, 'CANNOT_CANCEL', 'Chỉ có thể hủy đơn hàng ở trạng thái Chờ xử lý (PENDING).');
    }

    // Prisma transaction: claim the state transition first, then restore stock.
    // Restoring stock before claiming the transition let two concurrent cancels
    // both read PENDING, both increment stock, and both succeed: stock grew by
    // twice the ordered quantity while only one order was ever cancelled.
    const cancelled = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING',
          ...(!isIdorVulnerable() && !isAdmin ? { userId: requestingUserId } : {}),
        },
        data: { status: 'CANCELLED' },
      });

      if (claim.count === 0) {
        throw new AppError(400, 'CANNOT_CANCEL', 'Chỉ có thể hủy đơn hàng ở trạng thái Chờ xử lý (PENDING).');
      }

      for (const item of orderToCancel!.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return {
      ...cancelled,
      totalPrice: cancelled.totalPrice.toFixed(2),
      items: cancelled.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toFixed(2) })),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw databaseUnavailable();
  }
}

// Allowed forward transitions. CANCELLED is terminal: once stock has been
// returned an order must not be reopened, otherwise the same units can be
// released again by cancelling a second time.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  try {
    // Read first: the transition decision and the stock bookkeeping depend on
    // the current state, so a blind update is not enough.
    const current = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!current) {
      throw new AppError(404, 'NOT_FOUND', 'Đơn hàng không tồn tại.');
    }

    if (current.status === status) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Đơn hàng đã ở trạng thái "${current.status}".`,
      );
    }

    if (!ALLOWED_TRANSITIONS[current.status].includes(status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Không thể chuyển đơn hàng từ "${current.status}" sang "${status}".`,
      );
    }

    // Collapse duplicate lines so a product listed twice is restocked once with
    // its total quantity instead of once per line.
    const restockByProduct = new Map<string, number>();
    for (const item of current.items) {
      restockByProduct.set(item.productId, (restockByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Claim the transition inside the transaction. createOrder decrements
      // stock, cancelOrder returns it, so an admin cancellation must return it
      // too; two admins racing on the same order must only restock once.
      const claim = await tx.order.updateMany({
        where: { id: orderId, status: current.status },
        data: { status },
      });

      if (claim.count !== 1) {
        throw new AppError(
          409,
          'INVALID_STATUS_TRANSITION',
          'Trạng thái đơn hàng vừa thay đổi. Vui lòng tải lại và thử lại.',
        );
      }

      if (status === 'CANCELLED') {
        for (const [productId, quantity] of restockByProduct) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: quantity } },
          });
        }
      }

      return tx.order.findUniqueOrThrow({
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
    });

    return {
      ...updated,
      totalPrice: updated.totalPrice.toFixed(2),
      items: updated.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toFixed(2) })),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw databaseUnavailable();
  }
}
