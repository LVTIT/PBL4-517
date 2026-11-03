# Issue #65 teach-back

Refs #65. These are the implementer's explanations, not evidence that another
team member has reviewed, understood or accepted the change.

1. **Why did admin cancel lose inventory?** Checkout immediately deducts stock.
   The old admin status API only wrote CANCELLED, so it never returned those units.
2. **Why does CANCELLED -> PENDING create phantom inventory?** Customer cancel
   already returned the units. Reopening re-enables the customer's valid PENDING
   cancel claim without taking those units again; replay returns the same units twice.
3. **Why is stock >= 0 insufficient?** It only rejects negative stock. Both lost
   stock and excess positive stock can satisfy the constraint; it cannot express
   whether a particular order has already returned its units.
4. **Why claim before restore?** A read does not reserve transition ownership.
   Two readers can see PENDING and both restore. Claiming first makes restoration
   conditional on winning one authoritative state change in the transaction.
5. **How does updateMany with source status prevent a race?** The source status
   is in the SQL write predicate. PostgreSQL waits for a competing row writer and
   rechecks that predicate after the writer commits. The loser updates zero rows
   and throws before any restock. Validation of a stale read alone is insufficient.
6. **Which admin transaction wins?** The first transaction to acquire the Order
   write lock and successfully commit the conditional transition. Request arrival
   order is not a guaranteed winner order. If it rolls back, a waiting contender
   can still claim the original state.
7. **Why only one restock for customer/admin cancellation?** Both paths claim the
   same Order source state before restoring in their transactions. After one
   commits CANCELLED, the other claim no longer matches. Customer loses with
   400 CANNOT_CANCEL, admin loses with 409 INVALID_STATUS_TRANSITION. The mixed
   test observed each path winning across fresh rounds without stock drift.
8. **Why enforce on backend with disabled UI options?** Direct HTTP clients and
   stale browser tabs can bypass or outlive UI choices. Only the service and
   conditional database write authorize the transition and its inventory effect.
9. **How do #61 and #65 differ?** #61 fixes atomic checkout stock claims, duplicate
   checkout totals and customer cancellation claims/ownership. #65 closes the
   separate admin status path: legal state edges, terminal states and admin restock.
10. **What if a merge loses #61's atomic cancel?** Two customer cancellations can
    both restore one order; the admin guard alone cannot protect that separate API.
    Losing checkout claims also reintroduces oversell losers reported as 503.
11. **Why are sequential tests insufficient?** The second request sees the first
    committed CANCELLED and is trivially rejected, even with race-prone read/write
    code. Real overlap lets both read the old state. SQL barriers prove that
    overlap; control C demonstrates two winners and phantom stock without claims.
12. **Why exclude #63?** Global Prisma error translation is a separate issue and
    behavior contract. Mixing it in broadens review and obscures whether failures
    originate in state/inventory fixes. #65 uses a local missing-order domain check
    and preserves existing unexpected-database-error behavior.
