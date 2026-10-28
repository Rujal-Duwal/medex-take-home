# Task 1 spec: Service Explorer (`/services`)

Story: "I need a full-body check-up near Bangkok, under 5,000 THB, and I'd like to compare a few hospitals side by side before I commit."

Budget: 11.5 hours, WBS 3.1 to 3.10. Milestone: tagged `task-1` by Wednesday 28 Oct mid-morning.

## Requirements (traceability ids from the plan)

- **T1-01** Results grouped by provider. Each card shows the provider and its rating, or "New, no reviews yet" when the rating is null.
- **T1-02** At most 3 matching services per provider, then "View all N services". N counts that provider's services under the active filters.
- **T1-03** Filters: service type (multi), category then subcategory (tree), provider (searchable multi), city or country, price range, "Available as a home test", free-text search over service title, provider name and category.
- **T1-04** Live facet counts: each option shows how many services it would give with every other active filter applied.
- **T1-05** Zero-count options are clearly unavailable (see D5).
- **T1-06** Final price by the brief's formula. Original price struck through when there is a discount.
- **T1-07** Wellness shows "from" the lowest option, with its duration.
- **T1-08** The price filter never mixes currencies (see D7).
- **T1-09** Sorts: relevance (D6), price low to high, price high to low, rating.
- **T1-10** The URL holds every filter, the sort and the page. Reload, shared links, back and forward restore the same view. No flash of an unfiltered list.
- **T1-11** Mobile: filters in a drawer; its "Show results" button shows the count for the pending selection before it is applied.
- **T1-12** About 100 ms per filter change with all 3,200 services; typing never blocks; no layout shift. Measured and written up.
- **T1-13** Skeletons while loading; empty state with a way out ("Remove the price filter"); API failure with retry.
- **T1-14** Keyboard only works; screen readers hear the new result count.
- **T1-15** Data mistakes handled and documented.
- **T1-16** Compare up to 3 providers side by side (from the story; WBS 3.10).

## Mock endpoints

Each data set is its own endpoint, as the brief asks. Flag names in brackets.

- `GET /api/mock/category/active` (`categories`)
- `GET /api/mock/providers` (`providers`)
- `GET /api/mock/service` (`services`)

## Data audit (assert these in `scripts/audit-data.ts`)

- 13 top-level categories, 21 subcategories, 67 providers, 3,200 services. About 2,853 are visible.
- Visibility: service `status === true`, provider `status === "active"`, and its category (if it has one) `status === true`.
- Hidden because of that rule:
  - category "Seasonal Offers" has status false (46 services)
  - providers 161 and 162 are inactive (113 services)
  - 198 services have status false
- If any subcategory has status false, treat it like its category and add a Decision.
- Two top-level categories share the slug `ultrasound`: one is type `package`, one is `lab_test`. The subcategory slug `thyroid` appears three times. Category keys therefore always include the type: `package.ultrasound`, `package.ultrasound.thyroid`.
- 22 services have no `categoryId`. They stay visible under an "Other" category option (key `other`).
- Providers 61, 105, 122, 139 and 156 have rating null and 0 reviews: show "New, no reviews yet" and sort them last by rating.
- 747 cases where one provider lists the same title more than once, always at different prices. Keep them as separate listings.

### Edge cases (service ids ending 0001 to 0007)

| id | Data | What the customer sees | Test |
|---|---|---|---|
| 0001 | 6200, 10% off, 7% service charge | 5,970.60 THB, 6,634.00 struck through (6,200 plus the 7% charge; see Decisions) | yes |
| 0002 | amount discount 500 on 3500 NPR | 3,000.00 NPR plus any charge, original struck through | yes |
| 0003 | Signature Facial, 60 min 1,800 THB, 90 min 2,040 THB | "From 1,800.00 THB, 60 min" | yes |
| 0004 | status false | hidden | yes |
| 0005 | Vitamin D, discount 600 on price 450 | invalid discount ignored: 450.00 THB, no strike-through | yes |
| 0006 | price 0.00 | "Free" | yes |
| 0007 | title `"  hba1c   TEST (Diabetes) "` | displayed trimmed with single spaces; found by "hba1c test" in any case | yes |

Rule behind 0005: a discount larger than the price is a provider mistake. Ignore the discount, keep the service charge. Record it in Decisions. Apply the same check to wellness options.

## Pricing (WBS 3.2)

`src/lib/money/` holds the shared parts; Task 1 specifics live in `src/features/services/pricing.ts`.

```
discountAmount = discountType === 'percent' ? price * discount / 100 : discount
afterDiscount  = price - discountAmount
chargeAmount   = serviceChargeType === 'percent' ? afterDiscount * serviceCharge / 100 : serviceCharge
finalPrice     = afterDiscount + chargeAmount
```

- All maths in big.js. Round only in the formatter (2 dp). Format with `Intl.NumberFormat` and the provider currency.
- Output type, so "unknown" and "free" cannot be confused with numbers:
  `{ kind: 'fixed', final: Money, original?: Money }` | `{ kind: 'from', lowest: Money, durationInMinutes: number, original?: Money }` | `{ kind: 'free' }`
- Precompute each service's price once when mapping, not on every render.

## Query engine (WBS 3.3)

One pure module, `src/features/services/engine.ts`, used by the server render and the client.

Input: mapped services, the filter state, sort, page. Output: provider groups for the page, total service and provider counts, facet counts for every option.

- Within one facet, selected options are OR. Across facets, AND.
- Facet counts: for facet F, apply every filter except F, then count services per option of F. Counts are services, not providers.
- Search: trim, collapse whitespace, lowercase. Match on title, provider name, category and subcategory titles. Precompute the normalised search text per service.
- Groups: services grouped by provider. Show the first 3 under the sort; "View all N" uses the filtered count.
- Pagination (D9): 10 provider groups per page, groups ordered by each group's best service under the current sort.
- Sorting:
  - relevance (D6)
  - price sorts only inside one currency (D8)
  - rating: provider rating high to low, then review count, nulls last
- Performance: one pass to apply all filters, one extra pass per facet. Benchmark target under 20 ms for the engine (Vitest bench), leaving room for React inside the 100 ms budget.

## URL codec (WBS 3.4)

`src/features/services/url-codec.ts`, shared by server and client. Defaults are left out of the URL. Unknown or bad values are dropped quietly.

| Param | Example | Meaning |
|---|---|---|
| `q` | `q=thyroid` | search text |
| `type` | `type=package&type=lab_test` | service types |
| `cat` | `cat=package.ultrasound.thyroid` | category or subcategory key, repeatable; `other` for no category |
| `provider` | `provider=48&provider=61` | provider ids |
| `loc` | `loc=city:bangkok` or `loc=country:TH` | one location |
| `cur` | `cur=THB` | currency for the price filter and price sort |
| `min`, `max` | `min=1000&max=5000` | price range in `cur` |
| `home` | `home=1` | home test only |
| `sort` | `relevance`, `price-asc`, `price-desc`, `rating` | default relevance |
| `page` | `page=2` | default 1 |
| `open` | `open=48` | provider groups expanded in place (D10) |
| `compare` | `compare=48,61,105` | up to 3 providers |

Tests: round trip for every param; bad input dropped; the three `thyroid` subcategories stay distinct.

## Rendering and states (WBS 3.5, 3.7)

- The page reads `searchParams` on the server and renders the first page of results from the same engine, so there is no unfiltered flash.
- The client then loads the three endpoints (with latency and failure flags) and takes over, so facet counts update on the client within the time budget. Propose how the hand-over avoids a flash or a hydration mismatch before building it.
- Typing uses `useDeferredValue` (or `startTransition`) so input never blocks.
- Reserve space for counts, cards and prices so updates cause no layout shift.
- Result count announced through the shared live region: "124 services from 18 providers".
- Empty state names the filters that are narrowing things and offers to remove one, starting with the one that would bring back the most results.
- Error state: plain message and "Try again". Keep the current filters.

## Filter panel and drawer (WBS 3.6, 3.8)

- Category tree: choosing a category reveals its subcategories. The two ultrasound categories appear under their own type labels.
- Provider: searchable multi-select (Radix-based combobox).
- Price: hidden until a currency is set (D7). Shows the currency choice with counts.
- Mobile drawer edits a pending copy of the filters. "Show 42 results" uses the engine on the pending copy. Closing returns focus to the button that opened it.

## Compare (WBS 3.10)

- Choose up to 3 provider cards to compare; the selection lives in the URL (`compare`).
- Side-by-side view: rating, location, number of matching services, price range of matching services, home test availability.
- Prices stay in each provider's currency. "Cheapest" is marked only among providers that share a currency.

## Decisions (defaults from the plan; silence means accepted)

- **D5 Zero-count options:** disabled in place with "0", never hidden. Hiding makes lists jump and hides what exists. A selected option stays enabled so it can be cleared. Zero-count providers sink below a divider.
- **D6 Relevance:** with search text: title match (exact word, then prefix, then contains) above category match, above provider name match; ties by rating, nulls last. Without search text: rating, then review count.
- **D7 Price filter currency:** the range appears once one currency is set. Set automatically when the location implies one country, otherwise a THB / NPR / INR choice inside the price filter, with counts.
- **D8 Price sort across currencies:** with no currency set, results split into currency sections, each sorted on its own. Never interleaved.
- **D9 Pagination:** 10 provider groups per page.
- **D10 "View all N services":** expands in place, kept in the URL (`open=48`); focus moves to the first newly shown service.
- Wellness and the price filter: a wellness service matches if any of its options falls inside the range. It is shown and sorted by its "from" price.
- Location is a single choice (one city or one country), so a location always implies at most one currency.
- Discount larger than price: ignore the discount (service 0005).

Add new decisions below this line as they come up.

- **Other holds 20 visible services, not 22 (WBS 3.1).** The data has 22 services with no `categoryId`; 2 of them are hidden by the other visibility rules. The customer sees 20 under "Other". The engine test "22 services under Other" expects 20 on visible data. Checked in `scripts/audit-data.ts`.
- **Hidden services overlap (WBS 3.1).** 46 + 113 + 198 = 357, but 347 services are hidden: 10 are hidden for more than one reason. 2,853 visible is exact.
- **"Always at different prices" means the pricing fields (WBS 3.1).** None of the 747 repeated provider and title groups repeat the same pricing. The `price` field alone repeats in 180 groups, almost all wellness, where `price` is null and prices live in the options.
- **Inactive subcategory (WBS 3.1).** None in the data. The mapper still hides it and its services, like an inactive category, so a future status change doesn't leak hidden services.
- **Broken references hide the service (WBS 3.1).** A service whose provider, category or subcategory is not in the data is hidden. None in the data today; the audit asserts that.
- **The struck-through price includes the service charge (WBS 3.2).** It is what the customer would pay without the discount: the brief's formula with the discount left out. Service 0001 shows 5,970.60 THB with 6,634.00 struck through, not 6,200.00. Why: with the bare `price` struck through, 39 prices in the data (a small discount plus a larger charge) would show a struck-through price equal to or lower than what the customer pays, which reads like a trick. Including the charge in both, the discount is the only thing that makes them differ, so the final price is always lower. With a percent charge the gap is the discount plus the charge on it (0001: 663.40, not 620), which matters for a "biggest saving" sort. The brief says only "the original price", so this fits it; it changes this spec's earlier 0001 row. The 39 is checked in `scripts/audit-data.ts`.
- **Discount larger than the price covers percent too (WBS 3.2).** A percent discount over 100 is the same mistake as 0005 and is ignored the same way. None in the data today, on services or wellness options; the audit asserts that.
- **A negative discount counts as no discount (WBS 3.2).** It would raise the price, which is not a discount. None in the data today, and no negative price or charge either; the audit asserts that.
- **Wellness always shows "From" (WBS 3.2).** Even with one option, since the price is unknown until a duration is chosen. The cheapest option is picked by final price, not list price (0003: the 90 min option is 2,040 after its discount, still above 1,800). A tie goes to the shorter option.
- **A final price of 0 shows "Free" (WBS 3.2).** That includes a discount that brings the price to exactly 0, shown as Free with nothing struck through. A wellness option priced 0 would show "From 0.00 THB". Neither is in the data today; the audit asserts that.
- **A service we can't price is hidden (WBS 3.2).** A non-wellness service with a null pricing field, or a wellness service with no options, has no honest price to show, and unknown is never 0. None in the data today; the audit asserts that.
- **The price range always carries its currency (WBS 3.3).** `min` and `max` only apply with `cur`, and the engine keeps them together (`PriceFilter`), so a range typed in THB can never be read as NPR, even when the location changes. Choosing a currency filters to it, even with no range: a THB range can't apply to NPR prices. The currency counts ignore the whole price filter but keep every other filter. Other filters' counts keep the price filter, so each count is what choosing that option would show: with a THB range set, Kathmandu shows 0 and is disabled (D5) until the price filter is cleared.
- **A location suggests the price currency, it doesn't filter by it (WBS 3.3).** D7 "set automatically" means: with a location chosen and no `cur`, the engine reports the location's currency (`priceCurrency`), so the price filter offers its range in THB at once. Entering a range writes `cur` into the URL (WBS 3.6). The location already limits results to one currency, so nothing else changes. In the data every country has exactly one currency; the audit asserts that. An earlier draft let the location's currency apply a bare `min`/`max`; code review showed the location counts then disagreed with the results, and a range changed currency with the location.
- **Search splits words on punctuation (WBS 3.3).** On top of trim, collapse and lowercase, anything that isn't a letter, digit or mark becomes a space (marks stay because Thai and Devanagari vowel signs are part of a word), on the search and on the data. "(Diabetes)" is then a whole-word match for "diabetes" (D6) and "check-up" matches "check up". "Women's" becomes "women s", so "womens" doesn't match; acceptable for English titles.
- **The whole search phrase must appear in one field (WBS 3.3).** "thyroid riverside" finds nothing, even though one service has "thyroid" in the title and "Riverside" in the provider name. Simple to explain; matching words across fields would be the next step. The category and subcategory titles count as one field, so "blood tests thyroid" finds a service under Blood Tests > Thyroid.
- **A page past the end shows the last page (WBS 3.3).** `page=9` with 3 pages shows page 3; with no results there is one empty page. The URL codec (WBS 3.4) drops values that aren't whole numbers; if one gets through anyway, the engine shows page 1.
- **Ties keep the data's order (WBS 3.3).** Two services with the same price or the same provider rating stay in the order MedEx sends them, so the result is the same on the server and the client.
- **Price filter and sort amounts carry their currency (WBS 3.3).** Each service keeps every amount the customer could pay as `Money`. The price filter checks each amount's currency before its value; the price sort compares only inside one currency section, through `compareMoney`, which throws on two currencies, like `addMoney`.
- **Price sort sections go THB, NPR, INR (WBS 3.3).** The order of the `CURRENCIES` list in `src/lib/money`. Pages run across sections; the page shows a heading where the currency changes.
- **The real-data engine tests live in `scripts/catalogue.test.ts` (WBS 3.3).** Only `scripts/` and `src/lib/mock` may read `data/`. They check 2,853 visible, 20 under Other, the two ultrasound categories, new providers last and service 0007.
- **The URL codec drops what the customer can't see (WBS 3.4).** `parseServicesUrl` takes the mapped catalogue as well as the URL, and drops provider ids, category keys and locations that aren't in it. A link to hidden provider 161 (`provider=161`) shows every provider instead of an empty page, and `cat=thyroid` is dropped because it could be any of the three. Why one function: the "unknown" rule lives in one place, and the server and the client both have the catalogue when they parse.
- **Amounts in the URL are plain decimals (WBS 3.4).** `min` and `max` must be digits with an optional decimal part: no sign, no exponent (`1e3` is dropped, not read as 1000). Any number of decimals is kept: a bound is not a price, and whatever the codec writes must read back, or a range like `max=99.999` would vanish on reload. A range with `min` above `max` is dropped and `cur` kept, since we can't tell which end the customer meant. Amounts are written with big.js `toFixed()`, so a huge amount never turns into an exponent.
- **Repeated and single params (WBS 3.4).** `type`, `cat`, `provider` and `open` repeat the param, like the spec's `provider` example; `compare` is comma-separated as the spec shows. Duplicates are dropped, keeping the first. `compare` keeps the first 3 visible providers. `loc`, `cur`, `sort`, `page`, `home` read the first value only; `home` is on only for `1`. `page` must be a whole number from 1; anything else is page 1. Ids and pages with a leading zero (`provider=048`, `page=02`) are dropped, so one view has one URL.
- **The address bar shows `%3A` and `%2C` (WBS 3.4).** The codec writes with `URLSearchParams`, which encodes `:` and `,`, so the app writes `loc=city%3Abangkok` and `compare=48%2C61`. Both forms parse the same, so a reviewer can still type `loc=city:bangkok`. Building the query string by hand would read nicer but means doing our own encoding; not worth it.
- **Search text is kept as typed (WBS 3.4).** `q` goes into the URL as the customer typed it, spaces included, so the box doesn't change under their cursor; the engine normalises it. Text that is only spaces is left out.

## Tests that must exist

- pricing: 0001, 0002, 0003, 0005, 0006, an amount service charge, rounding only at display
- engine: each facet ignores only its own filter; 3 filters active at once; 2,853 visible; the two ultrasound categories kept apart; 22 services under Other; null ratings last; search with whitespace and case (0007)
- url codec: round trip, bad input, thyroid under three parents
- bench: engine over 3,200 services for a set of filter states, median and p95 recorded

## Performance write-up (WBS 3.9)

1. Vitest bench: median and p95 for the engine.
2. Production build: `performance.mark` / `performance.measure` from the input event to the commit that shows new results, logged to the console.
3. Chrome DevTools CPU throttling 4x; INP via `web-vitals`.
4. Layout shift checked with the Performance panel and Lighthouse; target CLS 0.
5. README table: machine, browser, throttle, median and p95 per step.

## Likely live extensions (keep these easy)

Add a "Discounted only" filter with its count; sort by biggest saving; switch zero options from disabled to hidden; add a fourth currency; show the home test charge; allow 4 providers in compare.
