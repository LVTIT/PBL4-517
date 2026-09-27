# Issue #14 — minimal verification data proposal

**Separately approved by human and executed 2026-09-27.** Browser/API verification passed. Final product stock is 0; one cancelled synthetic order remains. No demo seed or admin account.

Production database is initially empty. To verify product detail/cart/order
without running development seed, request explicit human approval for one clearly
labelled synthetic verification product. No public demo password or admin account.
Use the separately approved ordinary customer registration with a random password.

Exact new Product fields (insert via existing Prisma client, not schema changes):

```json
{
  "id": "7e517014-0000-4000-8000-000000000001",
  "name": "Deployment verification item - NOT FOR SALE",
  "description": "Synthetic item for Issue 14 deployment verification only. No real purchase or delivery.",
  "price": "10000.00",
  "stock": 2,
  "category": "Deployment verification"
}
```

If approved: insert only if ID is absent (fail on collision, no upsert), confirm
public API and browser detail, add quantity 1 to cart, submit one order through
the normal authenticated flow using a fictitious test address. Check order total,
ownership and stock decrease; cancel that customer's own order via normal UI/API,
confirm stock restoration. This is normal user functionality, no OWASP exploit.
Finally set this exact product's stock to 0, retaining the cancelled order as
verification history. No other products, user roles or orders will be changed.

If declined: keep products empty and report product/order verification incomplete.
Admin flow remains unverified without an approved production-safe admin account.
