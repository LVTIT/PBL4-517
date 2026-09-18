export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
  };
}

export interface Product {
  id: string;
  name: string;
  description: string;
  // Prisma's exact decimal is serialized as a string. Convert only for display.
  price: string;
  stock: number;
  category?: string;
  averageRating?: number;
  reviewCount?: number;
  reviews?: Review[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
}

export interface AuthData {
  user: User | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  product?: {
    id: string;
    name: string;
  };
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: string;
  userId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  totalPrice: string;
  status: OrderStatus;
  shippingAddress: string;
  createdAt: string;
  updatedAt?: string;
  items: OrderItem[];
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
}

export interface ApiResponse<T> {
  data: T;
}
