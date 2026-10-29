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

- **The server hands the client a finished view, not data (WBS 3.5).** The page runs the codec and engine, then `toResultsView` turns the result into plain strings and links (`ResultsView`), which go to `ServiceExplorer` as a prop. Until the client has loaded the three endpoints it shows that view; then it runs the same codec, engine and `toResultsView` on the URL and renders the same `ServiceResults` in the same place. Same data and URL, same output, so there is no flash, no hydration mismatch, and React keeps the DOM (checked in the browser: the same nodes before and after). Why not pass the catalogue or the engine result: they hold Big amounts and Maps, which can't go from a server component to a client one, and 3,200 services in the HTML would double the download.
- **`/category/active` returns inactive categories too (WBS 3.5).** The mock endpoints send the data as MedEx gave it, the hidden rows included. The data's readme says the shapes follow MedEx's API, and the file holds inactive categories, so we serve them. The customer sees no difference: `mapCatalogue` hides them, as it would if the endpoint had filtered them.
- **The first render waits for `?mockDelay` but never fails (WBS 3.5).** The page reads the data directly (like a server calling MedEx's API internally), so the random latency and `mockFail` don't apply to it; failures stay on the client's calls (ADR 0011). It does wait out `mockDelay`, so the loading skeleton (`loading.tsx`) can be seen on a first load.
- **If the client load fails, the error replaces the results; offline keeps them (WBS 3.5).** Any one of the three endpoints failing fails the load, since a service can't be shown without its provider and category. With an error the customer sees "We couldn't load services" and "Try again" (the URL, so the filters, stay); the server's results go, because nothing on them would work. Offline is different: the results are still right for this URL, so they stay under the offline banner, and the load runs again when the browser is back online, with the results kept up meanwhile.
- **"Taking longer than usual" after 3 seconds (WBS 3.5).** Normal latency is under 1 second. The note shows while the client load is still running and is read out once through the live region.
- **The result count and page are read out when they change, not on load (WBS 3.5).** "124 services from 18 providers, page 2 of 3": the page is included so following a page link is heard too, since the count stays the same. The hand-over is silent, because nothing changed for the customer. After "Try again" the count is read out even if it is the same, so a screen reader user hears that results are back. Focus moves to the results area when "Try again" is pressed.
- **Page and "View all" links drop the mock flags (WBS 3.5).** They are built by the URL codec, which writes only the view's params. A reviewer types the flag again after following one. Carrying them would mean the codec knowing about the mock.
- **"View all N" keeps focus on the link for now (WBS 3.5).** The link becomes "Show fewer" in the same place, so focus stays on it instead of falling to the page. D10 asks for focus on the first newly shown service; that is still to do.
- **No results shows only "No services match your filters" (WBS 3.5).** The empty state with a way out ("Remove the price filter") is WBS 3.7. Done in WBS 3.7; see below.
- **Filters write the URL with the history API, not the router (WBS 3.6).** A change goes through `applyFilterChange` (`filter-changes.ts`), the codec writes the URL, and `history.pushState` sets it; Next.js syncs that into `useSearchParams` without asking the server again, so the 100 ms budget isn't spent on a round trip. Back undoes each tick (T1-10). The first letter typed adds an entry and the next letters replace it, so Back undoes the whole edit, not each letter; any other change, or Back itself, ends that run, so the next letter adds a new entry. A change that leaves the URL the same (a space in an empty box, the same price again) adds nothing. Next applies the new URL inside `startTransition`, which is the spec's "useDeferredValue (or startTransition)": a `useDeferredValue` on top would add nothing. The search box keeps its own text, so typing shows at once; a tick shows together with the new results (measured in WBS 3.9). Mock flags drop on the first change, like the page links (WBS 3.5).
- **The panel is shown but disabled until the client has the catalogue (WBS 3.6).** The server renders it from `toFiltersView`, so it is in the first HTML and nothing moves, but a change can't be counted without the data. Normally under a second; with `?mockDelay` the slow note explains the wait. Sending early changes through the server would work too, but is a second code path to explain.
- **Category tree (WBS 3.6).** Ticking a category chooses all of it and shows its subcategories. Ticking a subcategory narrows the category to the subcategories ticked (the category key leaves the URL, or it would match everything and the subcategory would change nothing). Unticking the last subcategory goes back to the whole category, so the list stays open. Unticking the category clears it and its subcategories. A category with some subcategories ticked shows a dash; clicking it clears the category and its subcategories, like any ticked category. A hand-typed URL with both keys shows both ticked; the category wins, as the engine says. Each type's categories sit in their own group ("Package", "Lab test"), so the two Ultrasound options are told apart. Other comes last.
- **Unavailable options stay focusable (WBS 3.6).** D5 options with 0 are muted and `aria-disabled`, not `disabled`, as `docs/design-system.md` asks: a screen reader still reaches them, and unticking a chosen option with 0 doesn't drop focus. Clicks on them do nothing. Zero-count providers sink to the end of one list, with a divider above them, so a provider that crosses the divider keeps its DOM node. A browser still drops focus from a node React moves, so after unticking a provider that sinks, `ProviderFilter` puts focus back on it. The location select is the exception: a native option can't stay focusable, so there it is plain `disabled`.
- **Simpler controls than the handoff (WBS 3.6).** Provider: a name box over the checkbox list, which the handoff draws as an inline list, so it isn't a popup combobox and needs no `cmdk`. The name box only narrows the list on screen and isn't in the URL. The list shows the first 8 providers, plus any ticked further down, with "Show all 65 providers" (the ones with visible services) / "Show fewer providers" (`aria-expanded`, focus stays on the button), the same pattern as "View all N services". There's no paging and no box that scrolls inside the panel. While a name is typed, every match shows. Location and sort: native `<select>` (country groups with "All of Thailand" first, then its cities). Price: Min and Max boxes with "Apply price", no slider. Home test: a checkbox with its count, like every other option, not a switch. The currency step is a row of buttons, not the handoff's RadioGroup: picking one is a step, not a value kept on screen. Counts are bare numbers in a fixed-width column ("0", not the handoff's "(0)"), the same for every option.
- **Service types and currencies offered are the ones in the catalogue (WBS 3.6).** A type or currency no visible service has would always be 0, which says nothing. All five types and all three currencies are in the data.
- **The currency step's note fits the counts (WBS 3.6).** With results in more than one currency it uses the handoff copy, "These results use more than one currency. Pick one to set a price range." With results in one, it says "Pick a currency to set a price range." Picking one moves focus to the Min box; "Change currency" moves it back to the first currency. It shows only when it would change something: for a chosen `cur`, and not when the location's currency is that same one (Bangkok with a THB range), where it would only clear the range.
- **Price boxes accept grouping commas (WBS 3.6).** "5,000" is read as 5000, since that's how prices are shown; anything else must pass the codec's amount rule, so it reads back from the URL. A box that can't be read, or a lowest price above the highest, gets focus and a message, and nothing is applied.
- **Clear all removes every filter and the search, keeps the sort and open groups (WBS 3.6).** Focus moves to the "Filters" heading, since the button goes away.
- **The search box follows the URL only while it isn't focused (WBS 3.6).** Next updates `useSearchParams` in a transition, so while typing the URL it reports can be a keystroke behind the box. Clear all and clicking Back happen with focus elsewhere. Back from the keyboard can happen while typing, so the box also follows the address bar on `popstate`.
- **Below the large breakpoint the panel sits above the results (WBS 3.6).** The drawer (WBS 3.8) replaces that. Filter chips are left for WBS 3.7 with the empty state, which names the same filters. Done in WBS 3.7; the drawer is done in WBS 3.8, see below.
- **On large screens the panel sticks beside the results (WBS 3.6).** It scrolls on its own when it is taller than the window, so the filters stay in reach while scrolling the results. It fits the window only once it has stuck; with the page at the top it starts lower and its end is below the window. So it has no `overscroll-contain`: at the panel's end the wheel carries on to the page, which brings the end into view.
- **The count is read out once it settles (WBS 3.6).** The live region waits 500 ms after the count last changed. Typing "thyroid" changes it on most letters, and a count per letter would talk over the letters a screen reader echoes.
- **An empty price range in the location's currency removes the price filter (WBS 3.6).** With Bangkok, Apply with both boxes empty drops `cur` rather than keeping `cur=THB`, which would leave Nepal and India at 0 with no Change currency to undo it. In a chosen currency, an empty Apply keeps the currency with no bounds.
- **Selects draw their own arrow (WBS 3.6).** The browser's arrow sits against the right edge and ignores padding, so `appearance-none` hides it and a chevron sits 12px in. The control is still a native `<select>`.
- **The empty state removes a whole filter, not one value (WBS 3.7).** One button per filter in use ("Remove the price filter (124 services)", "Clear the search"), ordered by how many services removing it brings back, most first; a tie keeps the panel's order. A filter whose removal still finds nothing isn't offered, since that button would lead to the same empty page. "Clear all filters" comes last, only with two filters or more: with one it would repeat that filter's button. The handoff shows a single button; the spec asks for the filters "starting with" the best one, so they are all listed and the first is the main button. The count is in the label so the customer sees what each choice brings back. The chips above name each value. After a click, focus moves to the results.
- **One chip per chosen value, in the panel's order (WBS 3.7).** The order doesn't follow the URL, so it stays the same when one goes and "the next chip" is where the removed one was. A chip sends the same change as its checkbox, so the two can't disagree. Removing the last subcategory chip therefore goes back to its whole category, as unticking it does: "Ultrasound: Thyroid (Package)" becomes "Ultrasound (Package)". Labels carry what a bare title can't tell apart: "Ultrasound (Package)" and "Ultrasound (Lab test)", "Ultrasound: Thyroid (Package)", "Other category". Search shows the text in quotes.
- **Price chips (WBS 3.7).** "Prices in NPR" removes the price filter; the range chip ("1,000.00 THB to 5,000.00 THB", "From ...", "Up to ...") removes the bounds and keeps the currency, like an empty Apply. With a location in the same currency there is no currency chip (it would remove nothing, as Change currency is hidden then), and the range chip removes the whole price filter, for the same reason as an empty Apply (WBS 3.6).
- **Chip focus (WBS 3.7).** After a chip is removed, focus goes to the chip now in its place, or to the row's "Clear all filters" if it was the last in the row (HANDOFF section 5). With no chips left the row goes, and focus moves to the results. The row's button also moves focus to the results; the panel's "Clear all" keeps moving it to the Filters heading. Both show on large screens, as the handoff draws them: one at each place the customer looks. The row's is named "Clear all filters", not the handoff's "Clear all", so a screen reader user can tell the two apart. Removing the search chip sends `remove-filter`, not a `search` change, so it adds a history entry even right after typing and Back brings the search back.
- **Chips are buttons at 44px, not 36px (WBS 3.7).** The handoff draws 36px chips; the shared Button keeps every control at least 44px tall (`docs/design-system.md`), so the chips use it as it is, rounded.
- **The slow note floats at the bottom of the window (WBS 3.7).** It used to push the results down when it appeared after 3 seconds, a layout shift. It is now fixed at the bottom, out of the page flow, so nothing moves. It is still read out once through the live region. While it shows, the page has a bottom `scroll-padding` of 6rem, so a link focused behind it scrolls clear of it (WCAG 2.4.11, technique C43). The compare tray (WBS 3.10) also sits at the bottom; it must not end up under the note.
- **An empty catalogue says so (WBS 3.7).** With no filters and no results there is nothing to remove, so the empty state says "No services to show" / "There are no services to show right now. Please check back later." with no button. Not in the data.
- **A bare currency equal to the location's has no chip (WBS 3.7).** Pick THB in the currency step, then Bangkok: the URL keeps `cur=THB` with no range. Bangkok already limits results to THB, so a "Prices in THB" chip would remove nothing, and only "Bangkok" shows. Removing Bangkok then shows "Prices in THB", and the results stay in THB, since the customer did choose it. Accepted: nothing is filtered without a chip saying so once it matters. Dropping `cur` when a location is chosen would be the alternative, but it would undo a choice the customer made.
- **Range chips round like prices (WBS 3.7).** The chip formats its bounds with `formatMoney`, 2 decimals. A hand-typed `max=99.999` reads "Up to 100.00 THB" while a 100.00 THB service is filtered out. The panel's boxes show the exact bound. Rare enough to accept; the fix would be printing the bound unrounded.
- **The drawer edits a draft and applies it as one history entry (WBS 3.8).** Below the large breakpoint the panel is hidden and a "Filters" button opens a full-screen drawer. Each change there goes to a copy of the query, and the same engine counts the options and the footer button ("Show 42 results") from that copy. "Show N results" writes the URL once, so Back undoes the whole drawer edit; a draft equal to the URL adds nothing. Esc or the close button drops the draft. Focus goes to the "Filters" heading on open and back to the button on close. N counts services, like the results heading. The button reads "Filters (3)" with the number of chips, as the handoff draws it.
- **On small screens the search is on the page, not in the drawer (WBS 3.8).** The handoff puts it above the Filters button, and it applies as you type, as on large screens. So the drawer's "Clear" removes every filter but keeps the search (`clearDrawerFilters`): clearing it from the drawer would remove something the customer can't see. The panel's "Clear all" still clears the search too.
- **At 0 the drawer's button says "No results, change filters" and does nothing (WBS 3.8).** The handoff says disabled; it is `aria-disabled`, not `disabled`, so it stays focusable and its label can be heard, like the D5 options. The pending count is read out through the shared live region once it settles (500 ms, like the results count), as "42 results with these filters": reading the button's "Show 42 results" would sound like an instruction. Radix hides the page behind the drawer from screen readers but leaves live regions alone, so the region still speaks.
- **A plain Radix Dialog, no shadcn Sheet and no accordion (WBS 3.8).** shadcn's Sheet is a styled Radix Dialog; the drawer uses the Dialog directly, full screen, so there's one file less to explain. The handoff draws the sections as an accordion; the drawer shows the same fields as the panel, in the same order, so there's one layout of filters to learn and test.
- **One filter panel in the page at a time (WBS 3.8).** The panel's fields have fixed ids (`services-location`, option ids). With the panel hidden by CSS and the drawer open, both would be in the page and a label could point at the hidden copy. So the explorer takes the panel out while the drawer is open. Widening the window past the breakpoint with the drawer open keeps the drawer until it is closed. The two search boxes (panel and page) are always both in the page, so they have their own ids.
- **Back while the drawer is open keeps it open (WBS 3.8).** The results behind it follow the URL; the draft doesn't, and "Show N results" applies it on top. With more time: close the drawer on Back, as phone users expect.
- **On a phone "Sort by" is read out but not shown (WBS 3.8).** There's no room for it beside the Filters button, and the handoff shows none there. It is visible from the small breakpoint up.
- **The bench runs on the real data, in `scripts/` (WBS 3.9).** Only `scripts/` and `src/lib/mock` may read `data/`, and a benchmark over made-up services wouldn't say much. `scripts/engine.bench.ts` times the engine and the whole per-change step (codec, engine, both views) for six filter states, each checked against its count first. Vitest reports p50 and p99 but not p95, so the bench works out p95 from the kept samples (nearest rank). Every state is under 5.1 ms on the M2 Pro (README). Under Vitest, calls between our modules go through import getters a production bundle doesn't have, so the numbers run slightly high; Vitest's warning about it is turned off with that reason in `vitest.config.mts`, because its fix, running without the module runner, can't resolve the `@/` alias.
- **Timings are recorded, not logged (WBS 3.9).** The spec says "logged to the console"; Rujal chose no console output on the customer's side. Each change is a `performance.measure` named `filter-change`, from the moment it reaches the explorer (a click, or typing the search box sends on) to the commit that shows its results (a layout effect). Back or forward clears a change still being timed. It shows in the DevTools Performance panel and in `performance.getEntriesByName("filter-change")`. While typing, a commit for an earlier letter isn't measured, only the one that matches the address bar. A change that leaves the URL the same isn't measured.
- **INP from DevTools, not `web-vitals` (WBS 3.9).** The plan named the `web-vitals` library. Chrome DevTools' live metrics show INP and CLS with no new dependency, and nothing has to ship to customers to measure them. The 4x throttled rows in the README are taken by hand.
- **Typing sends the search at most once every 250 ms (WBS 3.9).** Safari allows 100 history changes per 10 seconds and throws a `SecurityError` past that (WebKit's `History.cpp` on main, read 29 Oct 2026; older Safari releases may use a longer window, not checked). Each URL change the explorer makes costs two: its own, and the `replaceState` Next.js makes after it (checked in Chrome: 59 letters made 118 history writes in 7.7 s). Past the limit, Next's own write would throw inside a React commit and show the error page. So `SearchBox` sends the first letter at once, holds later ones, and sends the latest text when 250 ms have passed: at most 8 history writes a second. Waiting text is sent at once when focus leaves the box, so a tick or the Filters button builds on everything typed; Back drops it. After the change, the same 59 letters made 66 writes in 10.6 s. This changes WBS 3.6, where every letter was written: the box still shows each letter at once, but results follow up to 250 ms behind while typing. The `filter-change` timing starts when the change reaches the explorer, so it leaves out that wait.
- **The drawer's draft starts from the address bar (WBS 3.9, found in review).** With the throttle, tapping Filters right after typing sends the waiting text on blur, and Next may not have applied it to `useSearchParams` before the drawer opens. The draft used to start from `useSearchParams`, so "Show N results" could write the search without its last letters. The explorer now reads the address bar as the drawer opens (`handleDrawerOpenChange`), as every other change does. The test's fake router keeps its own copy of the URL, like Next, so it can lag and the test catches this.
- **The tick shows with its results: fast on a laptop, slow at 4x CPU (WBS 3.9).** WBS 3.6 left open whether a checkbox, whose tick comes from the URL in Next's transition, would feel slow. Unthrottled, the tick and the new results reach the screen a median 8.2 ms after the click (p95 16.9 ms). At 4x CPU it is a median 161 ms (p95 284 ms), over T1-12's 100 ms. Input stays responsive (INP about 104 ms by the browser's event timings, 32 ms in DevTools live metrics; the box shows each letter within a frame), because the render runs in a transition. Long Animation Frame timings put the time in React rendering the results and the panel: 57 to 75 ms of script per change at 4x, about 10 ms of it the engine, 10 to 15 ms a layout forced during the commit. Not fixed in 3.9, recorded as unfinished in the README. Next steps: draw the tick from local state at the click, before the URL catches up, and find the forced layout.
- **Browser rows were taken at phone width (WBS 3.9).** The automated Chrome window couldn't be resized, so the script ticked the desktop panel's options, which are in the page but hidden by CSS below the large breakpoint. The engine and the results list are the same at any width; the 4x rows by hand are at desktop width.
- **Compare is not a filter (WBS 3.10).** The list lives in the URL (`compare`), but no filter change, Clear all or way out touches it, and it doesn't change the results. Each tick, chip removal or Clear is a history entry, like a filter, so Back undoes it. It isn't timed as a `filter-change`. Compared providers stay in the tray when the filters hide their card.
- **The comparison counts under the filters, without the provider filter (WBS 3.10).** Matching services, the price range and home tests are the engine's results for the compared providers, so they agree with the cards. The provider filter is left out: with `provider=48` set, a second compared provider would otherwise always show nothing. For the same reason the "With your filters" line leaves the provider chips out. A provider with nothing matching shows "None with your filters".
- **The price range uses the price each card shows (WBS 3.10).** A wellness service counts at its "From" price, not its dearest option, so the range never shows an amount the results don't. A Free service shows "Free", as in "Free to 5,970.60 THB". All at one price shows one amount.
- **"Lowest price" (WBS 3.10).** Marked on the cheapest starting price among compared providers in one currency, only when at least two of them have a price in it. A tie marks each. With currencies mixed, the label names the currency ("Lowest price in THB") and the handoff's note explains why there is no single cheapest. Prices are compared with `compareMoney`, so two currencies can't be compared by mistake.
- **Home test row reads "Yes, 2 services" or "No" (WBS 3.10).** The handoff only names the row. A count of matching services that are home tests says more than yes or no, and fits the other rows.
- **On a phone the table scrolls sideways (WBS 3.10).** The handoff draws a swipeable carousel (Embla) with "2 of 3". That is a new dependency and a second layout of the same facts. The table stays a real table: the row labels are pinned on the left (narrower on a phone), each provider column is at least 12rem wide so the next one peeks in and shows there is more to scroll to, and the table's area takes focus so it scrolls with the arrow keys (axe `scrollable-region-focusable`). From the small breakpoint up the dialog is a large centred panel; below it, full screen.
- **The Remove buttons sit in a row of their own (WBS 3.10).** Inside the column headers, a screen reader would read "Remove ..." as part of every cell's column name. They are in a second header row of plain cells, so the column name stays the provider's name.
- **Undo lives in the open comparison (WBS 3.10).** It puts the provider back in the column it left. It is gone when the comparison closes (Esc, Back to results, View services), since the status line it belongs to is gone too. Back or Forward can change the list while the comparison is open; Undo is only shown while it would work (`canRestore`: the provider isn't back already and there is room), so it never does nothing. An empty list closes the comparison, however it emptied (its last Remove, or Back), and focus moves to the results, since the tray and its button are gone; Forward then doesn't reopen it (found in review).
- **Opening with 1 provider shows the table and the handoff's "Pick at least one more to compare" (WBS 3.10).** The Compare button stays enabled with 1, as the handoff's "Opened with 1 provider" state shows. "Lowest price" is never marked then.
- **Whether the comparison is open is not in the URL (WBS 3.10).** A reload or shared link shows the tray with its providers; the customer opens the comparison again. The tray comes from the server too, so it is in the first HTML.
- **"View services" links to that provider's matching services (WBS 3.10).** The same filters, the provider filter set to that one provider, its group opened in place (D10) so every service the column counted shows, and the compare list kept. It closes the comparison; focus goes back to "Compare (N)".
- **The 4th Compare box is `aria-disabled` with the hint (WBS 3.10).** With 3 chosen, the other cards' boxes stay focusable and say "You can compare up to 3" (`aria-describedby`), like the D5 options. A chosen box can always be unticked. Until the client has the catalogue the boxes and the tray are plain `disabled`, like the panel.
- **The slow note and the tray share the bottom of the window (WBS 3.10).** `BottomDock` stacks them, the note above the tray, so neither hides the other (the WBS 3.7 note). It measures its own height (the note comes and goes, the hint takes a line on a phone, the chips wrap on wider screens) and keeps that much clear in three places, so nothing with focus sits behind it (WCAG 2.4.11): the page's bottom `scroll-padding` (plus 1rem, since scrolling only counts the element's box and the focus ring is drawn outside it: checked in Chrome, without it the home test box's ring ended under the tray), a spacer at the end of the page so the last card and the pagination scroll clear, and the large-screen filter panel, which scrolls on its own where `scroll-padding` doesn't reach, so its height leaves out `--bottom-dock-height` (found in review). This replaces WBS 3.7's fixed 6rem. Tests stub `ResizeObserver`, which jsdom lacks.
- **On a phone the tray's chips stay on one line (WBS 3.10).** Wrapped, three chips took about 40% of a 375px screen. They scroll sideways instead, with the hint and buttons on a second line, so the tray is about 125px tall. From the small breakpoint up they wrap, as the handoff draws them.
- **Tray focus (WBS 3.10).** After a tray chip is removed, focus goes to the chip now in its place, or to Clear if it was the last in the row. Clear, or removing the last chip, takes the tray away, so focus moves to the results. The chips are named "Remove X from compare" (handoff); the buttons inside the comparison "Remove X from the comparison".

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
