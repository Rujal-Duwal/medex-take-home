# Task 3 spec: Booking across time zones (`/booking`)

Story: "I live in Kathmandu. I'm booking a check-up at a hospital in Bangkok for when I travel there next month. Which time is the appointment, mine or theirs?"

Budget: 7.25 hours, WBS 5.1 to 5.8. Milestone: tagged `task-3` by Friday 30 Oct around 15:00.

## Requirements (traceability ids from the plan)

- **T3-01** Calendar for the next 90 days. Past days, closed days (weekly or a closure) and days with no free slots are visibly unavailable, each with a reason.
- **T3-02** Two clocks: provider time first, the customer's own time alongside. Never confusing.
- **T3-03** Slots grouped into morning, afternoon, evening. Booked slots visible but not selectable. Today's started slots unavailable, judged by the provider's clock.
- **T3-04** Choosing a specialist narrows the slots. Only the overlap of consultation hours and opening hours is bookable, and the customer is told why some advertised hours are missing.
- **T3-05** Group bookings up to 4 people need N consecutive free slots with the same specialist. Only offer start times where that works.
- **T3-06** On 409, keep everything entered, explain what happened, offer the closest alternatives.
- **T3-07** Reschedule from `existingBooking`; the old-to-new change is unmistakable before confirming.
- **T3-08** Skeletons for calendar and slot grid; help and a way forward when nothing is available; retry without losing selections; slow and offline states; a booking whose result is unknown can never be confirmed.
- **T3-09** Calendar and slot grid fully usable with arrow keys; correct screen reader announcements.
- **T3-10** Unit tests for time zone and slot logic, awkward cases included.
- **T3-11** `dayOffset` turned into real dates when the mock starts; 409, latency, 500 and network errors on demand.
- **T3-12** Every stored time zone value handled; fallback documented.

## Mock endpoints

Flag names in brackets.

- `GET /api/mock/providers/:id` (`provider`) returns the provider with specialists, schedule and resolved time zone
- `GET /api/mock/providers/:id/slots?date=YYYY-MM-DD&specialistId=` (`slots`) returns slots for that date with `isBooked` and `isCurrentBooking`
- `GET /api/mock/providers/:id/availability?specialistId=&people=` (`availability`) returns one entry per day for 90 days: `{ date, status: 'available' | 'past' | 'closed-weekly' | 'closure' | 'full' | 'outside-hours', reason?, firstStart? }`. **This endpoint is our addition** (the calendar needs day-level status without 90 slot calls). Record it in Decisions and the README.
- `POST /api/mock/bookings` with `{ providerId, specialistId, date, startTime, numberOfPeople }` (`book`) returns `201 { bookingId }` or `409 { message }`
- `PUT /api/mock/bookings/:id` with `{ date, startTime }` (`reschedule`) returns `200` or `409`

Customer time zone override for demos: `?tz=Asia/Kathmandu` (D16).

## Time zone resolver (WBS 5.1)

`resolveTimeZone(raw, country)` in `src/features/booking/time-zone.ts`. Returns `{ zone, source: 'iana' | 'alias' | 'windows' | 'offset' | 'country-fallback', raw }`. Never pass an unresolved string to Luxon or `Intl`.

Order: trim, try IANA, then a known alias map, then a Windows-name map, then offset parsing, then the country's zone.

| Provider | Stored value | Resolves to | Source |
|---|---|---|---|
| 48 | `"Asia/Bangkok"` | Asia/Bangkok | iana |
| 46 | `" UTC+05:45"` | Asia/Kathmandu (offset matches country NP) | offset |
| 112 | `"Nepal Standard Time"` | Asia/Kathmandu | windows |
| 118 | `"(GMT+5:45)"` | Asia/Kathmandu (offset matches country NP) | offset |
| 121 | `"Asia/Katmandu "` | Asia/Kathmandu | alias |
| 131 | `""` | Asia/Kolkata (country IN) | country-fallback |

- Offsets: parse `UTC`, `GMT`, brackets, `+5:45` and `+05:45`. If the offset matches the country's zone, use the country's IANA zone; otherwise use a fixed-offset zone.
- Log which source was used (server side, once per provider).

## Slot generator (WBS 5.2)

`generateSlots(specialist, daySchedule, date, zone)` is pure.

- Slots start at `consultation.startTime` and repeat every `durationInMinutes + bufferInMinutes`.
- A slot is kept only if it ends by `consultation.endTime` and lies entirely inside that day's opening hours.
- A missing weekday in `daySchedules` means closed.
- Times are wall-clock in the provider's zone. Convert with Luxon only at the edges.
- "Started" means slot start is at or before `now` in the provider's zone. `now` is an argument.
- When some of a specialist's advertised hours fall outside opening hours that day, return a note the UI can show: "Dr. N. Rana sees patients until 21:00, but the hospital closes at 20:00 on Thursdays, so the last appointment is 19:40."

### Known cases (each needs a test)

- Dr. N. Rana (48), 18:00 to 21:00, 20 + 0: Mon to Thu slots 18:00 to 19:40 only (hospital closes 20:00). None on Friday (closes 17:00) or Saturday (closes 13:00).
- Dr. P. Chaiyaporn (48) starts 07:00 but the hospital opens 08:00 (09:00 Saturday): the 07:00 slot is never offered.
- Dr. A. Wongsakul (48), 10:00 to 16:00, 30 + 10: on Saturday only 10:00, 10:40, 11:20 and 12:00 (12:40 would end at 13:10, after closing).
- Dr. M. Thapa (121): 20:00 to 22:30 Kathmandu.
- Dr. V. Mehra (131): 21:00 to 23:30 India time, which is 22:30 to 01:00 for a customer in Bangkok, so the customer's clock shows the next day.
- Nepal providers open Sunday to Friday.

## Mock data set-up (WBS 5.3)

- At mock start, turn each `dayOffset` into a real date: day 0 is today **at the provider**, in its resolved zone.
- Closures: provider 48 at day 12 (public holiday), provider 46 at day 4 (staff training). Use the stored reason as the customer-facing reason.
- 613 booked slots, day 0 to 29, all on the grid. Assert both in `scripts/audit-data.ts`.
- `existingBooking` BK-20261008-0042: provider 48, Dr. Wongsakul, day 3, 11:20, 1 person. That slot is not in `bookedSlots`. Mark it `isCurrentBooking`, never free (D18).
- Bookings open for 90 days only.

## Availability and groups (WBS 5.4)

- Day status comes from, in order: past, closed weekly, closure, outside hours for this specialist, full. Each has a plain reason.
- Group start times (D17): for N people, start S is offered only if S and the next N-1 grid slots (each `duration + buffer` later) are all free, not started, and inside opening hours. The buffer between them is allowed.
- Closest alternatives after a 409: up to 3 free start times for the same specialist and group size, nearest in time on the same day first, then the next available days.

## UI (WBS 5.5 to 5.7)

- Two clocks: "10:40 Bangkok time" as the main label, with "12:25 your time (Kathmandu)" beneath. When the customer's date differs, add "next day" or "previous day" in words, not just "+1".
- A short line at the top says which time is which: "Times are shown in Bangkok time, where your appointment is. Your own time is shown underneath."
- Calendar: grid pattern with arrow keys (left and right by day, up and down by week, Home and End for the week, Page Up and Page Down for the month). Unavailable days stay focusable and announce their reason.
- Slot grid: arrow keys within and across the morning, afternoon and evening groups. Booked slots announce "booked".
- Specialist picker narrows slots and shows the overlap note when it applies.
- Confirm step shows provider, specialist, date, both clocks and the number of people. Reschedule shows "From: <old day>, 11:20 Bangkok time" and "To: <new day and time>" side by side before the confirm button.
- 409: keep provider, specialist, people and date; show what happened and the 3 alternatives as buttons.

## States (WBS 5.8)

- Skeletons for calendar and slot grid.
- Day with no slots or specialist with nothing in 90 days: say why, then offer the next available date or another specialist.
- Error: retry keeps every selection.
- Slow: the confirm button shows it is waiting and can't be pressed again.
- Offline or unknown result: the confirm button is disabled with the reason. A result that is still unknown is never shown as booked; the customer is told we are checking.

## Decisions (defaults from the plan; silence means accepted)

- **D16 Customer time zone:** the browser's zone, with a `?tz=` override so reviewers anywhere can replay the Kathmandu story.
- **D17 Consecutive slots:** next start = previous start + duration + buffer; all N free, not started and inside opening hours.
- **D18 Current booking during reschedule:** shown as "Your current booking", not selectable, never shown as free.
- Added `GET /providers/:id/availability` to the mock so the calendar can show day status in one call.
- Every time zone value and the source used, per the resolver table above.

Add new decisions below this line as they come up.

## Tests that must exist

- resolver: all 6 stored values; an unparseable value falls back to the country; a customer clock crossing midnight
- slots: Rana, Chaiyaporn, Wongsakul Saturday, Thapa, Mehra; started slots judged by the provider clock with an injected `now`; closures
- groups: 2, 3 and 4 people across buffers, including a booked slot in the middle
- existing booking marked current, not free

## Likely live extensions (keep these easy)

Change slot length or buffer for one specialist; allow 5 people; a "next available date" button; a provider in a time zone with daylight saving, with tests; booking across two specialists.
