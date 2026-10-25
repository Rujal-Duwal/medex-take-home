# MedEx marketplace: design handover

For: Next.js (App Router), Tailwind v4, shadcn/ui (Radix). Light theme only.
Design files open directly in a browser. Each file has a desktop frame (1440), a mobile frame (375) and a STATES column. Variants are labelled in small grey text above each one.

Rules that apply everywhere:
- Every price stays in the provider's currency. Never convert, never sum across currencies, no grand total.
- Format: `Intl.NumberFormat("en-US")`, 2 decimals, then a space and the ISO code: `5,970.60 THB`. Zero shows `Free`.
- Wellness has no price until a duration is picked.
- Loading uses skeletons only. Every error offers "Try again".

Where this file and `Tokens.dc.html` disagree, follow this file (see Known gaps).

---

## 1. Screens

### /services (`Services.dc.html`)
| Frame (`data-screen-label`) | What it shows |
|---|---|
| Services desktop | Filter panel, results, sort, chips, pagination, Compare checkbox on each card, sticky compare tray, compare dialog (live) |
| Services mobile | Search, Filters button, sort, chips, cards, compare tray, full-screen Filters sheet, full-screen compare view (live) |
| Compare desktop | Compare dialog, 3 providers, mixed THB/NPR (live, Remove + Undo work) |
| Compare mobile | Swipeable cards, "1 of 3" indicator (live) |

STATES column: Loading · skeleton · Empty · Error · Provider with no reviews · Offline · slow · Filter option rules (0 disabled, 0 selected stays clearable) · Price formats · Mobile filters · pending count before applying · Sort by price · no currency chosen · "View all 14 services" · expanded in place.
COMPARE STATES column: Tray · 1 picked · Card checkbox · 3 already picked · Opened with 1 provider · mobile · Provider removed inside the comparison · mobile · Screen reader notes.

### /cart (`Cart.dc.html`)
| Frame | What it shows |
|---|---|
| Cart desktop | Groups by service type (one order each), per-group subtotal and payment choice, summary aside with Payment summary by currency, checkout result page |
| Cart mobile | Same, stacked; sticky "Check out all ready groups" bar |

Tweaks: `view` (Cart / Checkout result), `offline`, `mergeNotice`. Live: quantity rollback (push Liver Function Profile past 10), required duration, partial failure (the facial's first payment always fails), Try again, Pay at clinic instead.
STATES column: Guest cart merged after sign-in · Quantity change rolled back · Empty cart · Offline · Slow checkout · Payment summary · per currency, no grand total · Unavailable items · Page reloaded mid-checkout · checking your order.

### /booking (`Booking.dc.html`)
| Frame | What it shows |
|---|---|
| Booking desktop | Specialist, people 1 to 4, calendar + legend, slot grid by period, confirm panel |
| Booking mobile | Same, stacked; sticky confirm bar |

Tweaks: `mode` (New booking / Reschedule), `confirmOutcome` (Success / Someone just booked this slot / Result unknown), `customerZone` (Kathmandu / Los Angeles / Auckland), `offline`. Pick Dr. N. Rana on a Thursday for the hours note.
STATES column: Loading · calendar and slots · Slot taken while confirming (409) · No availability for this specialist · Offline · confirm disabled · Reschedule · before confirming · Slot when your day is different · Which time is which · Specialist hours vs hospital hours · Thursday · Calendar reason on focus or tap · Result unknown · confirm disabled.

---

## 2. Components

### shadcn/Radix mapping
| UI | shadcn / Radix | Notes |
|---|---|---|
| Buttons | Button | primary, outline, ghost, link. Min `h-11`, main actions `h-12` |
| Search, price min/max | Input | `inputmode="numeric"` for prices |
| Service type, subcategory | Checkbox | label + live count; see FilterOption |
| Category tree | Collapsible | parent shows summed count |
| Provider filter | Command (inline list) + Input | searchable multi-select with counts |
| City or country | Select (or Popover + Command as a combobox) | grouped country > city, counts, 0 disabled |
| Currency step | RadioGroup | THB / NPR / INR with counts, shown only when results span currencies |
| Price range | Slider (2 thumbs) | appears only once a currency is set |
| Home test | Switch | |
| Active filters | Button (secondary, X icon) | chip pattern + "Clear all" |
| Sort | DropdownMenu + DropdownMenuRadioGroup | price sort always enabled; groups by currency when none chosen |
| Results pages | Pagination | |
| Mobile filters | Sheet (side="bottom", full height) + Accordion | sticky footer: Clear, "Show N results" |
| Compare checkbox | Checkbox (in a bordered label) | disabled at 3 with hint |
| Compare tray | custom, `role="region"` | sticky bottom |
| Compare view | Dialog (desktop), full-screen Dialog or route (mobile) | build the grid as a real `<table>` |
| Mobile compare cards | Carousel (Embla) | Previous/Next buttons + "2 of 3" |
| Cart groups, summary, confirm panel | Card | |
| Duration, payment method, specialist | RadioGroup | card-style items, `min-h-12` |
| Quantity, people | custom QtyStepper (2 icon Buttons) | |
| Status badges | Badge | type (outline), Paid, Booked, Payment failed, No longer available, New, no reviews yet |
| Banners and notes | Alert | info (secondary), warning (warning-soft), destructive (destructive-soft) |
| Loading | Skeleton | `animate-pulse` |
| Calendar | Calendar (react-day-picker) | modifiers: past, closed, holiday, full, later |
| Day reason | Tooltip | opens on hover, focus and click; reason also in `aria-label` |
| Slot grid | ToggleGroup type="single" | grouped Morning / Afternoon / Evening |

### Custom components
- **FilterOption**: control + label + count. Variants: default, selected, disabled (count 0, not selected), selected with 0 (enabled, so it can be cleared). Disabled keeps 4.5:1 text and shows `(0)`.
- **PriceTag**: fixed (`5,970.60 THB`), discounted (final bold + struck original, SR text "Original price"), from (`From 1,800.00 THB, 60 min`), free (`Free`, success colour).
- **CurrencyTotals**: one row per currency, label "Covers N separate orders: …". Never summed.
- **DualTime**: provider time large, customer time below in muted. Adds ", next day" or ", previous day" when the customer's date differs.
- **QtyStepper**: optimistic update, dims the number while pending, rolls back with an inline reason.
- **CompareTray**: chips (remove), Clear, Compare (N). Hint: 1 picked "Pick at least one more to compare", 3 picked "You can compare up to 3".
- **CompareTable / CompareCard**: rows Rating, Location, Matching services, Price range, Home test available, View services. States: 2 to 3 providers, 1 provider, mixed currency, removed with Undo.
- **SlotButton**: default, selected, booked (dashed, disabled), current booking (dashed primary, disabled). Two lines: time + DualTime.
- **CalendarDay**: available, selected, today, current booking, unavailable (grey fill, struck number, short tag: Past, Closed, Holiday, Full, Later).
- **RescheduleCompare**: From (dashed) and To (primary) cards side by side with an arrow.
- **ResultCard** (cart): Confirming, Paid, Booked (pay at clinic), Payment failed, Checking.

---

## 3. Tokens

### Fonts (next/font)
Load from `next/font/google` with weights 400, 500, 600 and `display: "swap"`:
- `IBM_Plex_Sans` (subset latin) as `--font-plex`
- `IBM_Plex_Sans_Thai` (subset thai) as `--font-plex-thai`
- `IBM_Plex_Sans_Devanagari` (subset devanagari) as `--font-plex-deva`
- Optional `IBM_Plex_Mono` 400/500 as `--font-plex-mono`

Put the variable classes on `<html>`. Use `tabular-nums` on every price, quantity, count and time.

### globals.css
```css
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --background: #FAFAF8;
  --foreground: #16201E;
  --card: #FFFFFF;
  --card-foreground: #16201E;
  --popover: #FFFFFF;
  --popover-foreground: #16201E;
  --primary: #1F5F5B;
  --primary-foreground: #FFFFFF;
  --secondary: #E6F0EE;
  --secondary-foreground: #1F5F5B;
  --muted: #F1F3F1;
  --muted-foreground: #5B6663;
  --accent: #F1F3F1;
  --accent-foreground: #16201E;
  --destructive: #B42318;
  --destructive-foreground: #FFFFFF;
  --border: #E1E5E2;
  --input: #8C9693;
  --ring: #1F5F5B;
  --radius: 0.5rem;
  /* MedEx additions */
  --text-secondary: #3D4744;
  --success: #1E6B3A;
  --success-soft: #E8F4EC;
  --warning: #7A4B00;
  --warning-soft: #FFF4DB;
  --warning-foreground: #5A3800;
  --destructive-soft: #FDECEA;
  --destructive-strong: #8F1C13;
  --skeleton: #E4E8E6;
}

@theme inline {
  --font-sans: var(--font-plex), var(--font-plex-thai), var(--font-plex-deva), system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-text-secondary: var(--text-secondary);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-warning-foreground: var(--warning-foreground);
  --color-destructive-soft: var(--destructive-soft);
  --color-destructive-strong: var(--destructive-strong);
  --color-skeleton: var(--skeleton);
  --radius-sm: calc(var(--radius) - 4px); /* 4px checkbox */
  --radius-md: calc(var(--radius) - 2px); /* 6px badges */
  --radius-lg: var(--radius);             /* 8px inputs, buttons, slots */
  --radius-xl: calc(var(--radius) + 4px); /* 12px cards, panels */
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground font-sans antialiased; }
}
```

### Type scale (IBM Plex Sans)
| Class | Size / line / weight | Use |
|---|---|---|
| text-3xl | 30/38 · 600 | desktop H1 |
| text-2xl | 24/32 · 600 | mobile H1, compare title |
| text-xl | 20/28 · 600 | section headings, results headline |
| text-lg | 18/28 · 600 | card titles, slot times |
| text-base | 16/24 · 400 to 600 | body, filter labels, line items |
| text-sm | 14/20 · 400 to 500 | secondary lines, "your time" |
| text-xs | 12/16 · 500 | badges only |

Filter labels, line items and slot times never go below 16px.

### Spacing, radius, elevation
- Tailwind 4px scale. Used steps: 1 (icon gaps), 2 (chips, slot grid), 3 (label to control), 4 (mobile card padding), 6 (desktop card padding, columns), 8 (filters to results), 12 (desktop gutter).
- Radius: sm 4, md 6, lg 8 (`--radius`), xl 12.
- Cards are flat with a 1px border. Only popovers and menus get `shadow-lg`. Sticky tray and mobile footers get a soft top shadow.
- Hit targets: at least 44×44 (`h-11`), main actions 48 (`h-12`).

### Focus ring
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`. 2px ring with 2px offset, 7.1:1 on the page. Applies to every control, including calendar days, slots, chips, the switch and the compare heading (`tabIndex={-1}`).

### Contrast notes (WCAG 2.x, on white unless noted)
- foreground 16.7:1 · text-secondary 9.6:1 · muted-foreground 5.96:1 (5.7:1 on background, 5.3:1 on muted).
- White on primary 7.4:1 · primary on secondary 6.3:1 · white on destructive 6.6:1 · white on success 6.5:1.
- warning-foreground on warning-soft 9.7:1 · destructive-strong on destructive-soft 8.1:1 · success on success-soft 5.8:1.
- `--input` 3.05:1 is for control borders (3:1 rule). `--border` is decorative only.
- Status is never colour alone: always a word, usually an icon. Unavailable days are grey and struck through.
- Disabled options keep 4.5:1 text. Disabled is shown by a lighter border and `cursor-not-allowed`, never opacity.

---

## 4. Copy

### /services
- Headline: "42 services from 4 providers"
- Search placeholder: "Service, test or provider". Provider search empty: "No providers match that name."
- Currency step: "These results use more than one currency. Pick one to set a price range."
- Sort note (no currency): "More than one currency here, so price sorting groups results by currency."
- Split results note: "Sorted by price within each currency. We don't convert between currencies." Section head: "Prices in THB · 2 providers"
- Home test: "Available as a home test", "(12) with your other filters"
- Empty: "No services match" / "Try removing a filter. Your other choices will stay as they are." / "Remove the price filter" (or "Clear all filters")
- Error: "We couldn't load services" / "Something went wrong on our side. Your filters are saved." / "Try again"
- Offline: "You're offline. These results are from your last visit. We'll update them when you're back online."
- Slow: "This is taking longer than usual. We're still loading services."
- No reviews: "New, no reviews yet". Badge: "Home test available"
- Mobile filters: "Show 42 results" / "No results, change filters" / "Clear"
- Compare tray: "Compare (2)", "Clear", "Pick at least one more to compare", "You can compare up to 3"
- Compare view: "Compare 3 providers", "With your filters: Package, Wellness, Bangkok, Thailand" (or "With no filters applied"), "Back to results", "View services", "None with your filters", "Lowest price" (mixed: "Lowest price in THB")
- Compare note (mixed currency): "Prices are in each provider's own currency. We don't convert between them." + "“Lowest price” is only marked between providers that use the same currency."
- Compare with 1: "Pick at least one more to compare" / "Go back to results and tick “Compare” on another provider card."
- Compare removed: "Chao Phraya Hospital was removed from the comparison." / "Undo"

### /cart
- "You'll pay in 3 separate orders" / "Each group is booked and paid on its own. Prices stay in each provider's currency, so there is no combined total."
- Payment summary: "Payment summary by currency", "Covers 3 separate orders: Lab tests, Wellness, Packages", "No grand total. Each currency is charged separately.", "Wellness isn't included until you choose a duration."
- Duration: "Duration (required)", "Price depends on the duration you choose", "Choose a duration to see the price", "Choose a duration for Signature Facial first."
- Rollback: "Couldn't change quantity: up to 10 per test." / "Couldn't change quantity: you're offline. We kept it at 3."
- Unavailable: "No longer available", "Sukhumvit Lab Centre has stopped offering this. It can't be checked out.", "No longer available (1)", "These won't be checked out. Remove them to tidy your cart.", "1 unavailable item won't be included."
- Merge notice: "Welcome back. We merged the cart from your earlier visit. 4 changes:"
  - "Liver Function Profile: you had 2 here and 3 before. We kept the higher, 3."
  - "Thyroid Function Test was added from your earlier visit."
  - "Signature Facial: we applied the 90 min option you chose."
  - "Vitamin B12 at Lakeview is no longer available and was removed."
  - Button: "Got it"
- Empty: "Your cart is empty" / "Find a check-up, lab test or treatment and add it here." / "Browse services"
- Offline: "You're offline. Your cart is saved on this device. You can check out when you're back online." Reason under buttons: "You're offline. Checkout will be available when you reconnect."
- Not ready: "Wellness isn't ready yet and will stay in your cart."
- Buttons: "Check out lab tests", "Book packages" (pay at clinic), "Check out all ready groups (2)"
- Result: "Placing your orders" / "Each order is handled on its own. You can see each result below." / "2 of 3 orders went through" / "One payment didn't go through. You were not charged for it." / "All 3 orders went through" / "We sent the details to your email."
- Slow: "Still confirming your payment. Don't close this page."
- Paid: "Order #MX-48213. Your card was charged:" · Booked: "Order #MX-48215. Nothing was charged. Pay on the day at Riverside International Hospital:"
- Failed: "Your payment didn't go through and you were not charged. Your choices are saved." / "Try again" / "Pay at clinic instead" / "Trying again is safe. It uses the same order, #MX-48214, so you can't be charged twice."
- After result: "Still in your cart: Wellness" / "Back to cart"
- Reload mid-checkout: "Checking your order" / "The page reloaded while this payment was in progress. We're checking with the payment provider whether it went through." / "Paying again is turned off until we know the result, so you can't be charged twice."

### /booking
- Time explainer: "Each time shows Bangkok time first, where your appointment is. Your time (Kathmandu) is underneath in grey."
- Slot lines: "09:25 your time", "00:00 your time, next day", "18:00 your time, previous day", "Booked", "Your current booking"
- Day reasons: "Past", "Not open for booking yet", "Closed on Sundays", "Public holiday: Chulalongkorn Day", "Fully booked". Mobile hint: "Greyed days can't be booked. Tap one to see why."
- No day: "Pick a day in the calendar to see times." Reasons: "Choose a day to continue.", "Choose a time to continue."
- Empty periods: "Dr. Wongsakul doesn't consult in the evening.", "Dr. Rana doesn't consult in the morning.", "No afternoon times on Saturdays. The hospital closes at 17:00."
- Overlap note: "Dr. N. Rana sees patients until 21:00, but the hospital closes at 20:00 on Thursdays, so the last appointment is 19:40."
- No availability: "Dr. N. Rana has no free times in November" / "You can go to the next date with free times, or see another specialist." / "Go to Tue 1 Dec" / "See Dr. A. Wongsakul (Cardiology)"
- 409: "Someone just booked this slot" / "Your other choices are saved. These are the closest free times:" + 3 time buttons
- Offline: "You're offline. You can still look at times, but they may be out of date. Confirming needs a connection." Reason: "You're offline. Your choices are saved; you can confirm once you're connected."
- Result unknown: "Checking your booking" / "We didn't get a reply in time. We're checking with the hospital whether it went through." / "We're checking the result of your last attempt. Confirming again is off until we know, so you won't be booked twice."
- Buttons: "Confirm booking", "Confirm new time", "Confirming…", "Checking…", "Make a change"
- Done: "You're booked" / "Your appointment has moved" / "We've sent the details to your email."
- Reschedule: "Your change", "From", "To"

---

## 5. Interaction notes

### Filters (/services)
- Each option is a checkbox with its count in the accessible name. Options with 0 are disabled, except a selected one (still clearable).
- Results headline is `aria-live="polite"` and updates after every change.
- Chips: accessible name "Remove filter: Package". After removing, focus goes to the next chip, or "Clear all" if none are left.
- Price slider: arrows ±500, inputs mirror the thumbs. "Change currency" resets the price filter.
- Sort: DropdownMenu radio items, arrows to move, Enter to pick, Esc to close, focus back on the trigger.

### Mobile filters drawer
- Opens from "Filters"; focus moves to the "Filters" heading; Tab stays inside.
- Changes are a draft. The footer button shows the pending count ("Show 42 results") and is disabled at 0.
- Esc or the close button discards the draft. Apply or close returns focus to "Filters". After applying, the headline is announced.

### Compare tray and comparison
- Card checkbox name: "Compare Riverside International Hospital". At 3, the others are disabled with the hint "You can compare up to 3".
- Tray (`role="region"`, "Compare tray") tab order: provider chips (each "Remove X from compare"), Clear, Compare (N).
- Opening: focus moves to the comparison heading (`tabIndex={-1}`). Tab is trapped inside. Esc or "Back to results" closes it, and focus returns to the Compare button that opened it.
- Removing a provider inside: focus moves to the heading, and a status line announces "… was removed from the comparison." with Undo. With 1 left, "Pick at least one more to compare" is announced. Removing the last one closes the view.
- Desktop: real `<table>`, provider names as `<th scope="col">`, row labels as `<th scope="row">`.
- Mobile: carousel (`aria-roledescription="carousel"`), each card a slide named "Name, 2 of 3". Previous/Next buttons for keyboard. The "2 of 3" indicator is polite live. Row labels repeat on every card.

### Cart
- Quantity value is polite live. A rollback reason is `role="alert"` and focus stays on the stepper.
- Duration and payment are radio groups (arrow keys). Checkout buttons stay focusable when disabled, with the reason right below and linked by `aria-describedby`.
- On checkout, move focus to the result headline (polite live). On failure, the failed card's "Try again" is next in tab order.

### Booking
- Calendar: arrows move by day, Home/End to week start/end, PageUp/PageDown by month. Unavailable days stay focusable (`aria-disabled`), and their reason opens in a Tooltip on focus, hover or click and is part of the day's name ("Sat 5 Dec 2026, not available: Public holiday: Father's Day"). On mobile, tapping a greyed day writes the reason in a polite live line under the calendar. Month title is polite live. The legend sits under the grid.
- Picking a day keeps focus on the day and announces "Times on Mon 16 Nov 2026".
- Slot grid: one tab stop per period group; arrows move between slots and skip booked ones. Name: "10:40 Bangkok time, 09:25 your time".
- People stepper: 1 to 4, buttons disabled at the limits, value polite live.
- Confirm: disabled while offline, while pending and while the result is unknown, with the reason below. After success, focus goes to the confirmation status. On 409, focus goes to the alert heading. The 3 alternatives are buttons; picking one keeps specialist, people and date.

---

## 6. Known gaps (follow the written spec here)
- **"View all N services" expanded**: shown only as a static example (Riverside, 14 packages). The live prototype only has a few sample services per provider. Expand in place, then "Show fewer" (`aria-expanded`); focus stays on the button.
- **`Tokens.dc.html` is out of date on 3 points.** It was kept unchanged on purpose; follow this file:
  - wellness format is "From 1,800.00 THB, 60 min"
  - different-day time reads "18:00 your time, previous day" (not a weekday)
  - price sort is not disabled without a currency; it groups by currency
- **Static only**: Services offline/slow/error, Cart "Checking your order" after reload, unavailable-items section, Booking "No availability", "Calendar reason on focus or tap".
- **Keyboard behaviour the prototype doesn't fully implement**: calendar arrow keys, slot-grid arrow keys (every slot is a tab stop there), focus after removing a tray chip, after applying the drawer, after checkout and after a 409. Section 5 is the spec.
- **Compare view** uses ARIA grid roles on divs in the prototype. Build it as a real table.
- **Mock data**: the matching-service counts and price-range figures are made up for the mock. Use API values.
- **Price slider**: thumbs are keyboard only in the prototype; dragging is the standard Slider behaviour.
- **Not designed**: dark mode; loading and error inside the comparison; a generic booking error (use the Alert + "Try again" pattern); sign-in; provider and service detail pages; Thai or Devanagari provider names (fonts are set up for them).
