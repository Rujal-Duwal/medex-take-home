# 0007 Idempotent checkout with key-derived order ids and saved attempts

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: plan D4, D13, D14; WBS 4.1, 4.5; risk R4

## Context and problem

Each cart group is a separate order. If the second of three groups fails, the first must not be lost or charged twice, the customer retries only what failed, and a retry must never create a duplicate. A reload mid-checkout must show the true state. On Vercel, in-memory mock state is not shared between instances and resets on cold starts.

## Options considered

1. One idempotency key per group attempt, saved in `localStorage` before sending; order id derived from the key; "not found" treated as "still checking"
2. Server-side order store only
3. A real database (out of scope)

## Decision

Option 1. The key is reused after a 500, timeout, network error or offline, because the outcome is unknown. A new key is made only after a definite 402 or 409 and a change by the customer. Because the order id is derived from the key, any server instance returns the same id for the same key. On reload, unfinished attempts are re-sent with their saved key.

## Consequences

- Good: duplicate orders are impossible by construction, even across server instances.
- Good: the state machine is small and fully unit tested.
- Cost: the order status after a cold start is reconstructed, not stored. The README states this limit.
- References: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ and https://docs.stripe.com/api/idempotent_requests
