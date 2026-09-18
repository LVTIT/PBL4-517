import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { findCurrentUser } from '../services/auth-service.js';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
} from '../services/order-service.js';

const orderItemInputSchema = z.strictObject({
  productId: z.string().uuid('Mã sản phẩm không hợp lệ.'),
  quantity: z.number().int().min(1, 'Số lượng phải lớn hơn hoặc bằng 1.'),
});

const guestInfoSchema = z.strictObject({
  name: z.string().trim().min(1, 'Họ tên không được để trống.').max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Email không đúng định dạng.')),
  phone: z.string().trim().max(20).optional(),
});

const createOrderSchema = z.strictObject({
  items: z.array(orderItemInputSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm.'),
  shippingAddress: z.string().trim().min(5, 'Địa chỉ giao hàng phải có ít nhất 5 ký tự.').max(255),
  guestInfo: guestInfoSchema.optional(),
});

const updateOrderStatusSchema = z.strictObject({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

export const handleCreateOrder: RequestHandler = async (req, res) => {
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Dữ liệu đơn hàng không hợp lệ.');
  }
  const order = await createOrder(
    parsed.data.items,
    parsed.data.shippingAddress,
    req.session.userId ?? null,
    parsed.data.guestInfo
  );
  res.status(201).json({ data: order });
};

export const handleGetUserOrders: RequestHandler = async (req, res) => {
  if (!req.session.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để xem đơn hàng.');
  }
  const orders = await getUserOrders(req.session.userId);
  res.json({ data: orders });
};

function getParamId(param: string | string[] | undefined): string {
  if (typeof param !== 'string' || !param) {
    throw new AppError(400, 'INVALID_ID', 'Mã không hợp lệ.');
  }
  return param;
}

export const handleGetAllOrders: RequestHandler = async (_req, res) => {
  const orders = await getAllOrders();
  res.json({ data: orders });
};

export const handleGetOrderById: RequestHandler = async (req, res) => {
  const id = getParamId(req.params.id);
  if (!req.session.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để xem đơn hàng.');
  }
  const user = await findCurrentUser(req.session.userId);
  const isAdmin = user?.role === 'ADMIN';
  const order = await getOrderById(id, req.session.userId, isAdmin);
  res.json({ data: order });
};

export const handleUpdateOrderStatus: RequestHandler = async (req, res) => {
  const id = getParamId(req.params.id);
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Trạng thái đơn hàng không hợp lệ.');
  }
  const updated = await updateOrderStatus(id, parsed.data.status);
  res.json({ data: updated });
};
