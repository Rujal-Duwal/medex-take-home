# Task 2 spec: Cart and split checkout (`/cart`)

Story: "I put a lab test from one clinic, a facial from a spa, and a check-up package from a hospital in my cart. Then I tried to pay."

Budget: 8.25 hours, WBS 4.1 to 4.8. Milestone: tagged `task-2` by Thursday 29 Oct around 14:00.

## Requirements (traceability ids from the plan)

- **T2-01** Cart grouped by type. Each group shows a subtotal per currency. No grand total across currencies. A summary still tells the customer what they will pay.
- **T2-02** Quantity changes are optimistic, roll back with a reason on rejection, and five fast "+" taps end at the right quantity with no flicker and no out-of-order overwrites.
- **T2-03** A wellness item needs a chosen duration before its group can check out. Until then its price is unknown and never counted as zero anywhere.
- **T2-04** Unavailable lines (empty `product`) are clearly marked, can't be checked out, and are easy to remove.
- **T2-05** Check out one group or all of them. Each group is its own order with its own payment method: card or pay at clinic.
- **T2-06** Partial failure: nothing succeeded is lost or charged twice; the customer sees exactly what succeeded; they retry only what failed; a retry never creates a duplicate order.
- **T2-07** Reload or close mid-checkout: coming back shows the true state of each order, not a fresh start.
- **T2-08** Guest cart merge on sign-in: every overlap case designed, and the customer is told what changed.
- **T2-09** Latency and failure injectable per call; the same idempotency key returns the same order.
- **T2-10** Loading, empty, slow and offline states. Every action works by keyboard. Focus is managed on removal and on checkout step changes.
- **T2-11** README has the checkout state machine and explains how double charges are prevented.

## Mock endpoints

Flag names in brackets, for `?mockFail=<name>:<kind>`.

- `GET /api/mock/cart` (`cart`) returns `200 { cart }`
- `PATCH /api/mock/cart/items/:lineId` with `{ quantity }` (`cart-item`) returns `200 { cart }`, `409` or `500`
- `PATCH /api/mock/cart/items/:lineId` with `{ wellnessPricingId }` (`cart-item`) returns `200 { cart }`
- `DELETE /api/mock/cart/items/:lineId` (`cart-delete`) returns `204`
- `POST /api/mock/cart/merge` with `{ items: guestCart }` (`merge`) returns `200 { cart, changes }`
- `POST /api/mock/checkout` with `{ groupType, items, paymentMethod, idempotencyKey }` (`checkout`) returns `201 { orderId, status }`, `402`, `409` or `500`
- `GET /api/mock/orders/:orderId` (`orders`) returns `{ orderId, status: "pending" | "paid" | "failed" }`

A failure flag can target one group. `checkout:500:once` fails the first checkout call, whatever its group. `checkout@package:500:once` fails only the first package checkout, which shows "the second of three groups fails" (D13 order: lab tests, packages, wellness). Parsing and matching of the group form were built in WBS 2.2 (`src/lib/mock/flags.ts`); WBS 4.1 only passes `group: groupType` to `fetchApi` for checkout calls.

## Data audit

- `catalog`: 34 products.
- In the cart, `product.price` is already the final unit price. `itemCount` is the sum of quantities, not the number of lines.
- `serverCart` groups:
  - `lab_test`: 4 items; subtotals THB 1,677 and NPR 12,520
  - `wellness`: Signature Facial, no duration chosen, `priceUnknown: true`
  - `package`: THB 15,230 and INR 23,009.50
  - `unknown`: one line with an empty `product`
  - `totalItems` is 8 and includes the unavailable line
- Wellness options carry `amount_after_service_charge`, already the final unit price for that duration.
- Signature Hot Stone Massage (NPR) has only one duration option (D12).
- There is no quantity limit in the data, so the mock defines the 409 rule (D11).
- Subtotals are recomputed from the lines on the client after every change. Server subtotals are never trusted after an optimistic update.

## Mapping and selectors (WBS 4.2)

Pure functions in `src/features/cart/`:

- `mapCart(apiCart)` to UI lines: `{ lineId, title, providerName, quantity, unitPrice: Money | 'unknown', status: 'ok' | 'needs-duration' | 'unavailable', durations? }`
- `groupSubtotals(lines)` returns a list of `Money`, one per currency. Unknown and unavailable lines are excluded and counted separately.
- `checkoutReadiness(group)` returns `ready` or a list of plain-language blockers ("Choose a duration for Signature Facial").
- `paymentSummary(groups)` for the summary panel: per currency, the total across the groups being checked out and how many separate orders it spans. Adding THB to THB across groups is fine; THB to NPR never is.

## Optimistic quantity (WBS 4.4)

One small queue per line, in `quantity-queue.ts`, pure and tested.

- The UI shows the customer's latest intended quantity immediately.
- Only one request per line is in flight. While it is in flight, more taps just update the intended quantity.
- When the response arrives: if the intended quantity differs from what was sent, send one more request with the latest value. Requests always carry the absolute quantity, never "+1".
- Each request carries a sequence number; a response older than the last applied one is ignored.
- On 409 or 500: roll back to the last quantity the server confirmed and tell the customer why, in the line and through the live region ("You can book at most 10 of this test").
- Test: five taps, replies returned out of order, final quantity correct, at most two requests sent.

## Checkout (WBS 4.5, 4.6)

### Per-group attempt record

Saved to `localStorage` **before** the request is sent:

```
{ groupType, idempotencyKey, paymentMethod, itemsSnapshot, status, orderId?, error?, updatedAt }
```

### State machine (one per group)

```
idle -> submitting -> succeeded (pending | paid)
                   -> declined      (402: payment refused, customer can change method)
                   -> conflict      (409: cart changed, customer reviews the group)
                   -> unknown       (500, timeout, network error, offline)
unknown  -> submitting (retry with the SAME key)
declined -> idle (customer changes something) -> submitting with a NEW key
conflict -> idle (customer reviews)           -> submitting with a NEW key
```

- "Check out all" runs groups one at a time in a fixed order (lab tests, packages, wellness, others). A failure does not stop the rest (D13).
- The results screen lists one line per group: what happened, the order number when there is one, and the next step. "Retry" appears only on groups that did not succeed.
- Card result maps to `paid`; pay at clinic maps to `pending` with copy "Booked. You'll pay at the clinic." Record this as a Decision.

### Double charges

- A key is created per group attempt and saved before the call (D14).
- After `500`, timeout, network error or offline, the result is unknown, so the retry reuses the same key. The mock returns the same order if the first call did go through.
- A new key is made only after a definite `402` or `409` and a change by the customer.
- The order id is derived from the key (D4), so any server instance returns the same id. "Order not found" from `GET /orders` means "still checking", never "failed".
- The UI never shows a group as both paid and retryable.

### Reload safety

On load, read saved attempts. Any group left in `submitting` or `unknown` is re-sent with its saved key (safe, because the key makes it idempotent) and the screen shows "Checking your order" until it settles.

## Guest cart merge (WBS 4.7)

Triggered by a "Sign in (demo)" button. `mergeCarts(serverCart, guestCart, catalog)` is pure and returns `{ cart, changes }`.

| Case in the data | What happens | What the customer is told |
|---|---|---|
| Liver Function Profile: guest 3, server 2 | keep the higher, 3 (not 5) | "Liver Function Profile: we kept 3, the larger of your two carts, so you don't book the same test twice." |
| Lipid Profile: only in the guest cart | added | "Added Lipid Profile from before you signed in." |
| Signature Facial: guest chose 90 min, server has none | apply 90 min | "We used the 90-minute option you picked earlier." |
| Product `6b572fa4-...-ce208e`: not in the catalog | dropped | "One item from before you signed in is no longer available, so we removed it." |

`changes` entries: `{ kind: 'quantity-kept-higher' | 'added' | 'duration-applied' | 'dropped-unavailable', productId, title?, from?, to?, message }`.
Show them in a dismissible notice at the top of the cart, also announced through the live region.

## States and accessibility (WBS 4.8)

- Loading: skeleton groups. Empty cart: a link back to `/services`.
- Slow: skeletons stay; buttons that send requests show their own pending state and can't be double-pressed.
- Offline: banner; checkout buttons disabled with the reason; quantity changes queue only if that is simple, otherwise disabled with the reason.
- After removing a line, focus moves to the next line, or to the group heading if it was the last.
- After a checkout step changes, focus moves to the new step's heading.

## Decisions (defaults from the plan; silence means accepted)

- **D4 Mock state on Vercel:** order id derived from the idempotency key; the client keeps attempts in `localStorage` and treats "not found" as "still checking". Document the limit.
- **D11 409 rule:** at most 10 per line. The 409 message says so and the UI rolls back with that reason.
- **D12 Single-option wellness:** pre-select the only duration and say so; it does not block checkout.
- **D13 Check out all:** one group at a time in a fixed order; a failure does not stop the rest.
- **D14 Idempotency key:** one per group attempt, saved before sending; reused after 500, timeout or network error; new only after a definite 402 or 409 plus a change by the customer.
- **D15 Guest merge:** as in the table above.
- One group can contain several currencies (lab tests in THB and NPR). The brief makes each group one order, so the order shows one amount per currency. In production this would likely split by provider; note it in the README.
- Header count: "7 items" plus "1 no longer available", rather than the server's 8.

Add new decisions below this line as they come up.

## Tests that must exist

- subtotals per currency from lines, not server totals; wellness unknown never counted as 0
- five fast taps with out-of-order replies; 409 rollback
- the four merge cases
- every state transition in the checkout reducer; same key returns same order; 402 then retry uses a new key; reload resumes from saved attempts

## Likely live extensions (keep these easy)

Per-type quantity limit; a third payment method; cancel a pending order; show which orders are pay at clinic in the summary; a new merge overlap case.
