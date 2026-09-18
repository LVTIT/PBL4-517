import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { findCurrentUser } from '../services/auth-service.js';
import {
  addReview,
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  listReviews,
  updateProduct,
} from '../services/product-service.js';

const productSchema = z.strictObject({
  name: z.string().trim().min(1, 'Tên sản phẩm không được để trống.').max(150),
  description: z.string().trim().min(1, 'Mô tả không được để trống.'),
  price: z.number().min(0, 'Giá sản phẩm phải lớn hơn hoặc bằng 0.'),
  stock: z.number().int().min(0, 'Số lượng tồn kho phải là số nguyên không âm.'),
  category: z.string().trim().max(50).optional(),
});

const updateProductSchema = productSchema.partial();

const reviewSchema = z.strictObject({
  rating: z.number().int().min(1, 'Đánh giá từ 1 đến 5 sao.').max(5, 'Đánh giá từ 1 đến 5 sao.'),
  comment: z.string().trim().min(1, 'Nội dung nhận xét không được để trống.').max(1000, 'Nhận xét tối đa 1000 ký tự.'),
});

function getParamId(param: string | string[] | undefined): string {
  if (typeof param !== 'string' || !param) {
    throw new AppError(400, 'INVALID_ID', 'Mã không hợp lệ.');
  }
  return param;
}

export const getProducts: RequestHandler = async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  res.json({ data: await listProducts(search, category) });
};

export const getProduct: RequestHandler = async (req, res) => {
  const id = getParamId(req.params.id);
  res.json({ data: await getProductById(id) });
};

export const handleCreateProduct: RequestHandler = async (req, res) => {
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
  }
  const created = await createProduct(parsed.data);
  res.status(201).json({ data: created });
};

export const handleUpdateProduct: RequestHandler = async (req, res) => {
  const id = getParamId(req.params.id);
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
  }
  const updated = await updateProduct(id, parsed.data);
  res.json({ data: updated });
};

export const handleDeleteProduct: RequestHandler = async (req, res) => {
  const id = getParamId(req.params.id);
  await deleteProduct(id);
  res.json({ data: { success: true } });
};

export const handleAddReview: RequestHandler = async (req, res) => {
  const productId = getParamId(req.params.id);
  if (!req.session.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để đánh giá sản phẩm.');
  }
  const user = await findCurrentUser(req.session.userId);
  if (user?.role === 'ADMIN') {
    throw new AppError(403, 'ADMIN_CANNOT_REVIEW', 'Tài khoản Quản trị viên không thể gửi đánh giá sản phẩm.');
  }
  if (!req.is('application/json')) {
    throw new AppError(415, 'JSON_REQUIRED', 'Yêu cầu phải sử dụng application/json.');
  }
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Dữ liệu đánh giá không hợp lệ.');
  }
  const review = await addReview(productId, req.session.userId, parsed.data.rating, parsed.data.comment);
  res.status(201).json({ data: review });
};

export const handleGetReviews: RequestHandler = async (req, res) => {
  const productId = getParamId(req.params.id);
  res.json({ data: await listReviews(productId) });
};
