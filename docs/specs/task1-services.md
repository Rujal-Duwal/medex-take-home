# Task 1 spec: Service Explorer (`/services`)

Story: "I need a full-body check-up near Bangkok, under 5,000 THB, and I'd like to compare a few hospitals side by side before I commit."

Budget: 11.5 hours, WBS 3.1 to 3.10. Results, measurements and the traceability table are in the README, Task 1.

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
- 22 services have no `categoryId`. They stay visible under an "Other" category option (key `other`); 20 of them are visible (see Decisions).
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

## Pricing

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

## Query engine

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

## URL codec

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

## Rendering and states

- The page reads `searchParams` on the server and renders the first page of results from the same engine, so there is no unfiltered flash.
- The client then loads the three endpoints (with latency and failure flags) and takes over, so facet counts update on the client within the time budget, with no flash or hydration mismatch (see Decisions, Rendering and states).
- Typing uses `useDeferredValue` (or `startTransition`) so input never blocks.
- Reserve space for counts, cards and prices so updates cause no layout shift.
- Result count announced through the shared live region: "124 services from 18 providers".
- Empty state names the filters that are narrowing things and offers to remove one, starting with the one that would bring back the most results.
- Error state: plain message and "Try again". Keep the current filters.

## Filter panel and drawer

- Category tree: choosing a category reveals its subcategories. The two ultrasound categories appear under their own type labels.
- Provider: searchable multi-select (a name box over the checkbox list; see Decisions, Filter panel).
- Price: hidden until a currency is set (D7). Shows the currency choice with counts.
- Mobile drawer edits a pending copy of the filters. "Show 42 results" uses the engine on the pending copy. Closing returns focus to the button that opened it.

## Compare

- Choose up to 3 provider cards to compare; the selection lives in the URL (`compare`).
- Side-by-side view: rating, location, number of matching services, price range of matching services, home test availability.
- Prices stay in each provider's currency. "Cheapest" is marked only among providers that share a currency.

## Decisions

One line per decision. D5 to D10 are the plan's defaults; the rest were made while building. When the data is wrong, the line says what the data says, what the customer sees and why (hard rule 9).

### Plan defaults

- **D5 Zero-count options:** shown with "0", muted and `aria-disabled` (still focusable, a click does nothing), never hidden, so lists don't jump. A chosen option stays enabled so it can be cleared. Zero-count providers sink below a divider. The location select uses plain `disabled`, since a native option can't stay focusable.
- **D6 Relevance:** with search text, a title match (exact word, then prefix, then contains) beats a category match, which beats a provider name match; ties by rating, nulls last. Without search text: rating, then review count.
- **D7 Price filter currency:** the range appears once one currency is set, picked in the price filter (THB, NPR or INR, with counts) or suggested by the location.
- **D8 Price sort across currencies:** with no currency set, results split into currency sections in the order THB, NPR, INR (the `CURRENCIES` list), each sorted on its own, never interleaved. Pages run across sections, with a heading where the currency changes.
- **D9 Pagination:** 10 provider groups per page. A page past the end shows the last page; a page that isn't a whole number shows page 1.
- **D10 "View all N services":** expands in place and is kept in the URL (`open=48`); N counts under the active filters; focus moves to the first newly shown service.
- **Location is one choice** (one city or one country), so it implies at most one currency.

### Data

- **Other holds 20 visible services, not 22.** 2 of the 22 with no `categoryId` are hidden by the other rules. Tests expect 20.
- **Hidden services overlap.** 46 + 113 + 198 = 357, but 347 are hidden: 10 for more than one reason. 2,853 visible is exact.
- **"Always at different prices" means all the pricing fields.** None of the 747 repeated provider and title groups repeat every pricing field. The bare `price` repeats in 180, almost all wellness, where `price` is null.
- **An inactive subcategory would hide its services**, like an inactive category. None in the data.
- **A broken reference hides the service:** a provider, category or subcategory missing from the data. None today; the audit asserts that.
- **Provider 163 has no services.** Golden Mile International Hospital is active and rated 4.2 but lists no services. It is left out of the catalogue, like a service type no service has, so the provider filter offers 64 providers, matching the results. Kept, it would sit at 0 for good. The audit asserts it.
- **`/category/active` returns inactive categories too.** The mock serves the data as MedEx gave it; `mapCatalogue` hides them.

### Pricing

- **The struck-through price includes the service charge.** It is the brief's formula without the discount, so 0001 shows 5,970.60 THB with 6,634.00 struck through. With the bare `price` struck through, 39 prices (a small discount, a larger charge) would show a "was" price at or below what the customer pays. The brief only says "the original price". The 39 is checked in `scripts/audit-data.ts`.
- **A discount larger than the price is ignored, the charge kept** (0005: 450.00 THB, nothing struck through). The same goes for a percent discount over 100 and for wellness options. A negative discount counts as none. Only 0005 is in the data; the audit asserts the rest.
- **Wellness always shows "From"** the cheapest option by final price (a tie goes to the shorter one), even with one option, since the price is unknown until a duration is chosen.
- **A final price of 0 shows "Free"**, with nothing struck through. A wellness option priced 0 would show "From 0.00 THB". Only 0006 is in the data.
- **A service we can't price is hidden** (a null pricing field, or wellness with no options): unknown is never shown as 0. None in the data.

### Engine and search

- **The price range always carries its currency** (`PriceFilter`). `min` and `max` apply only with `cur`, so a THB range can't be read as NPR. Choosing a currency filters to it even with no range. Currency counts ignore the whole price filter; every other facet's counts keep it, so with a THB range Kathmandu shows 0.
- **A location suggests the price currency, it doesn't filter by it.** With a location and no `cur`, the range is offered in the location's currency; entering a range writes `cur`. Every country has one currency (audited).
- **Wellness and the price filter:** a wellness service matches if any option falls in the range; it is shown and sorted by its "From" price.
- **Money is compared only inside one currency.** The price filter checks the currency first; the price sort and "Lowest price" go through `compareMoney`, which throws on two currencies.
- **Search splits words on punctuation** (marks kept, for Thai and Devanagari), in the query and the data: "(Diabetes)" matches "diabetes" and "check-up" matches "check up"; "womens" doesn't match "Women's".
- **The whole search phrase must appear in one field:** "thyroid riverside" finds nothing. Category and subcategory titles count as one field.
- **Ties keep the data's order**, so the server and the client agree.
- **The real-data engine tests live in `scripts/catalogue.test.ts`**, since only `scripts/` and `src/lib/mock` may read `data/`.

### URL

- **The codec drops what the customer can't see.** It takes the catalogue, and drops provider ids, category keys and locations not in it: `provider=161` shows every provider, and `cat=thyroid` (it could be any of three) is dropped.
- **Amounts are plain decimals:** digits with optional decimals, no sign, no exponent; any number of decimals is kept, so what the codec writes reads back. `min` above `max` drops the range and keeps `cur`. Written with big.js `toFixed()`.
- **Repeated and single params.** `type`, `cat`, `provider` and `open` repeat; `compare` is comma-separated and keeps the first 3 visible providers. Duplicates are dropped. `loc`, `cur`, `sort`, `page` and `home` read the first value; `home` is on only for `1`. Ids and pages with a leading zero are dropped, so one view has one URL.
- **The address bar shows `%3A` and `%2C`**, from `URLSearchParams`. Both forms parse, so a reviewer can type `loc=city:bangkok`.
- **Search text is kept as typed** in `q`, so the box doesn't change under the cursor; the engine normalises it. Text that is only spaces is left out.

### Rendering and states

- **The server hands the client a finished view, not data.** `ResultsView` and `FiltersView` are plain strings and links. The client runs the same codec, engine and views on the same URL and renders the same components, so there is no flash and no hydration mismatch. Big amounts and Maps can't cross to a client component, and 3,200 services in the HTML would double the download.
- **The first render waits for `?mockDelay` but never fails**, so the skeleton can be seen; failures apply to the client's calls (ADR 0011).
- **A failed client load replaces the results with the error; offline keeps them.** Any of the three endpoints failing fails the load. "Try again" keeps the filters. Offline keeps the results under the banner and loads again when back online.
- **"Taking longer than usual" after 3 seconds**, floating at the bottom of the window so nothing moves, read out once.
- **The count is read out when it changes, once it settles** (500 ms), with the page: "124 services from 18 providers, page 2 of 3". Not on load. After "Try again" it is read out even if unchanged.
- **Focus goes to the results area** when the control that had it disappears ("Try again", a way out of the empty state, the last chip) and after any page link, since Previous and Next go away at the ends.
- **Page and "View all" links drop the mock flags**, since the codec writes only the view's params.
- **"View all" and "Show fewer" name their provider for screen readers** ("View all 44 services from Bodhi Medical Centre", "Show fewer services from Bodhi Medical Centre"), so two cards' identical links can be told apart (WCAG 2.4.9). Built in `results-view.ts` with the label.
- **An empty catalogue says "No services to show"**, with no button. Not in the data.

### Filter panel

- **Filters write the URL with `history.pushState`, not the router.** Next syncs `useSearchParams` with no server round trip, inside a transition, so input stays responsive. Each change is a history entry; the first letter typed adds one and later letters replace it. A change that leaves the URL the same adds nothing. Mock flags drop on the first change.
- **Typing sends the search at most every 250 ms**: the first letter at once, the latest text after, and any waiting text on blur. Safari throws past 100 history changes per 10 seconds, and each change costs two (ours and Next's). The box shows every letter at once.
- **The panel is server-rendered but disabled until the client has the catalogue**, so nothing moves and no change goes uncounted.
- **The cursor shows `progress` over the explorer while the catalogue loads**, not `not-allowed`, so a click too early reads as "wait". Not after an error or offline, when nothing is on its way. Links in the results keep working and show it too; accepted, since `progress` means busy but still usable. It is only the pointer, so skeletons still stand in for missing content. A mouse cue only: touch and keyboard users still see just the muted controls.
- **Category tree.** Ticking a category chooses all of it and shows its subcategories. Ticking subcategories narrows to them; unticking the last goes back to the whole category. A partly chosen category shows a dash. Each type's categories sit in their own group, so the two Ultrasound options are told apart. Other comes last.
- **Simpler controls than the handoff.** Provider is a name box over the checkbox list (the first 8 plus any ticked, with "Show all 64 providers"); location and sort are native selects with their own chevron; price is Min and Max with "Apply price", no slider; home test is a checkbox; the currency step is a row of buttons.
- **Only types and currencies in the catalogue are offered.**
- **The currency step** explains itself ("These results use more than one currency. Pick one to set a price range."), moves focus to Min after a pick and back with "Change currency", and shows only when removing the currency would change something.
- **Price boxes accept grouping commas** ("5,000"). An unreadable box, or a lowest price above the highest, gets focus and a message, and nothing is applied.
- **An empty Apply in the location's currency removes the price filter**; in a chosen currency it keeps the currency with no bounds.
- **Clear all** removes every filter and the search, keeps the sort, open groups and compare, and moves focus to the "Filters" heading.
- **The search box follows the URL only while it isn't focused** (and on `popstate`), since Next's URL can be a keystroke behind.
- **On large screens the panel sticks beside the results** and scrolls on its own, ending above the bottom dock.

### Chips and empty state

- **The empty state removes a whole filter, most results first:** one button per filter in use, with its count ("Remove the price filter (124 services)"). A filter whose removal still finds nothing isn't offered. "Clear all filters" comes last, with two or more filters.
- **One chip per chosen value, in the panel's order.** A chip sends the same change as its checkbox. Labels tell lookalikes apart ("Ultrasound (Package)", "Other category"); search shows in quotes.
- **Price chips.** "Prices in NPR" removes the price filter; the range chip removes the bounds and keeps the currency. With a location in the same currency there is no currency chip, since it would remove nothing.
- **Chip focus:** to the chip now in its place, or the row's "Clear all filters"; with no chips left, to the results. Removing the search chip adds a history entry, so Back restores it.
- **Chips are 44px tall**, not the handoff's 36px, so every control stays at least 44px.
- **Range chips round like prices.** A hand-typed `max=99.999` reads "Up to 100.00 THB". Rare; accepted.

### Mobile drawer

- **Below the large breakpoint, "Filters (3)" opens a full-screen drawer that edits a draft.** It is a plain Radix Dialog with the panel's fields. The same engine counts the draft's options and its "Show 42 results" button. Applying writes one history entry; Esc or close drops the draft. Focus goes to the heading on open and back to the button on close.
- **The draft starts from the address bar**, so letters typed just before tapping Filters aren't lost.
- **The search stays on the page**, as the handoff draws it, so the drawer's "Clear" keeps it.
- **At 0 the button reads "No results, change filters"**, `aria-disabled` and focusable. The pending count is read out as "42 results with these filters".
- **One panel in the page at a time:** the panel is taken out while the drawer is open, so field ids never repeat.
- **Back while the drawer is open keeps it open.** The results follow the URL; the draft doesn't. With more time: close it on Back.

### Performance

- **The bench runs on the real data** (`scripts/engine.bench.ts`) and works out p95 itself (nearest rank). Vitest's module getters make it run slightly high.
- **Timings are recorded, not logged:** a `filter-change` `performance.measure` from the change reaching the explorer to the commit that shows it. Rujal chose no console output on the customer's side.
- **INP and CLS come from DevTools live metrics**, not the `web-vitals` library: no new dependency, nothing shipped to customers.
- **The server runs in Mumbai (`bom1`, in `vercel.json`)**, not Vercel's default Washington, since the providers are in Thailand, Nepal and India and the service list is a large download. The filters stay disabled until it arrives: 2.0 to 3.1 s over three live loads before the move, not measured since.

### Compare

- **Compare is not a filter.** The list lives in the URL (`compare`), but no filter change, Clear all or way out touches it. Each change is a history entry. Compared providers stay in the tray when the filters hide their card.
- **The comparison counts under the filters, without the provider filter**, or a second compared provider would always show nothing. "None with your filters" when nothing matches.
- **The price range uses the price each card shows** ("From" for wellness, "Free" for 0).
- **"Lowest price" is marked inside one currency only**, on the cheapest starting price, when at least two compared providers have that currency; a tie marks each. With mixed currencies the label names the currency and a note explains why.
- **Home test reads "Yes, 2 services" or "No".**
- **On a phone the table scrolls sideways**: row labels pinned, columns 12rem so the next one peeks in, the area focusable. No carousel library. Full screen below the small breakpoint.
- **Remove buttons sit in their own header row**, so each column's name stays the provider's name.
- **Undo** puts a provider back in its column, while the comparison is open and only while it would work. An empty list closes the comparison and moves focus to the results.
- **Opening with 1 provider** shows the table and "Pick at least one more to compare", with no "Lowest price".
- **Whether the comparison is open isn't in the URL**; the tray is, and is in the first HTML.
- **"View services"** links to that provider's matching services (provider filter set, group open, compare kept) and closes the comparison.
- **With 3 chosen, the other cards' boxes are `aria-disabled`** with "You can compare up to 3". Before the catalogue loads, boxes and tray are plain `disabled`.
- **The slow note and the tray share `BottomDock`**, which measures its height and keeps it clear for focus (WCAG 2.4.11): the page's `scroll-padding` plus 1rem, a spacer at the page's end, and the sticky panel's height.
- **On a phone the tray's chips stay on one line** and scroll sideways.
- **Tray focus:** after a chip is removed, to the chip in its place or Clear; when the tray goes, to the results.

## Tests that must exist

- pricing: 0001, 0002, 0003, 0005, 0006, an amount service charge, rounding only at display
- engine: each facet ignores only its own filter; 3 filters active at once; 2,853 visible; the two ultrasound categories kept apart; Other (20 visible of the 22 with no category); null ratings last; search with whitespace and case (0007)
- url codec: round trip, bad input, thyroid under three parents
- bench: engine over 3,200 services for a set of filter states, median and p95 recorded

Where each one lives: README, Task 1, Tests.

## Performance write-up

1. Vitest bench (`npm run bench`): median and p95 for the engine and the whole per-change step.
2. Production build: a `filter-change` `performance.measure` from the change to the commit that shows its results (see Decisions, Performance).
3. Chrome DevTools at 4x CPU: the `filter-change` entries, and INP and CLS from live metrics.
4. Layout shift: a `layout-shift` observer and Lighthouse; target CLS 0.
5. Results: the README, Task 1, Performance.

## Likely live extensions (keep these easy)

Add a "Discounted only" filter with its count; sort by biggest saving; switch zero options from disabled to hidden; add a fourth currency; show the home test charge; allow 4 providers in compare. Where each change goes: `docs/ARCHITECTURE.md` section 9.
