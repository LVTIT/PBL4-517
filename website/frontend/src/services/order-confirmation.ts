import type { Order } from '../types/api';

const key = 'pbl517_last_order';

export function clearOrderConfirmation() {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

export function readOrderConfirmation(ownerId: string | null): Order | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (saved?.version === 1 && saved.ownerId === ownerId &&
        saved.order?.id && (saved.order.userId ?? null) === ownerId) {
      return saved.order as Order;
    }
    clearOrderConfirmation();
  } catch { clearOrderConfirmation(); }
  return null;
}

export function saveOrderConfirmation(ownerId: string | null, order: Order) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, ownerId, order }));
  } catch { /* Completed checkout stays successful if storage is unavailable. */ }
}
