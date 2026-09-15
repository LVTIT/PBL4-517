export interface Product {
  id: string;
  name: string;
  description: string;
  // Prisma's exact decimal is serialized as a string. Convert only for display.
  price: string;
  stock: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthData {
  user: User | null;
}

export interface ApiResponse<T> {
  data: T;
}
