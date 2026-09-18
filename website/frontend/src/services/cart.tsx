import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, Product } from '../types/api';
import { useAuth } from './auth';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  totalCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function getStorageKey(userId?: string | null): string {
  return userId ? `pbl517_cart_user_${userId}` : 'pbl517_cart_guest';
}

function loadCart(key: string): CartItem[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCart(key: string, items: CartItem[]): void {
  try {
    if (items.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(items));
    }
  } catch {
    // Ignore storage errors
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const isInitialMount = useRef(true);

  // Sync cart with current user authentication state
  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevUserIdRef.current = currentUserId;
      setItems(loadCart(getStorageKey(currentUserId)));
      return;
    }

    if (prevUserIdRef.current !== currentUserId) {
      const prevUserId = prevUserIdRef.current;
      prevUserIdRef.current = currentUserId;

      if (currentUserId) {
        // User logged in:
        // Merge any guest cart items into the user's existing cart
        const guestItems = loadCart(getStorageKey(null));
        const userItems = loadCart(getStorageKey(currentUserId));

        const mergedMap = new Map<string, CartItem>();
        for (const item of userItems) {
          mergedMap.set(item.productId, item);
        }
        for (const item of guestItems) {
          if (mergedMap.has(item.productId)) {
            const existing = mergedMap.get(item.productId)!;
            const newQty = Math.min(item.product.stock, existing.quantity + item.quantity);
            mergedMap.set(item.productId, { ...existing, quantity: newQty });
          } else {
            mergedMap.set(item.productId, item);
          }
        }
        const mergedList = Array.from(mergedMap.values());
        // Clear guest cart
        saveCart(getStorageKey(null), []);
        // Save and set user cart
        saveCart(getStorageKey(currentUserId), mergedList);
        setItems(mergedList);
      } else {
        // User logged out:
        // Clear active session cart so items do not leak to public/guest session
        saveCart(getStorageKey(prevUserId), items); // Ensure user's cart is safely saved under their ID
        saveCart(getStorageKey(null), []);          // Reset guest cart
        setItems([]);                               // Empty in-memory cart
      }
    }
  }, [user, items]);

  // Persist items whenever items change for the active user
  useEffect(() => {
    if (!isInitialMount.current) {
      const key = getStorageKey(user?.id ?? null);
      saveCart(key, items);
    }
  }, [items, user?.id]);

  function addToCart(product: Product, quantity = 1) {
    if (product.stock <= 0) return;

    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + quantity);
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: newQty, product }
            : item
        );
      }
      const initialQty = Math.min(product.stock, Math.max(1, quantity));
      return [...prev, { productId: product.id, product, quantity: initialQty }];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const safeQty = Math.min(item.product.stock, quantity);
          return { ...item, quantity: safeQty };
        }
        return item;
      })
    );
  }

  function removeFromCart(productId: string) {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  function clearCart() {
    setItems([]);
    saveCart(getStorageKey(user?.id ?? null), []);
  }

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalCount,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
