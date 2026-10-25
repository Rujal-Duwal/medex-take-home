# 0005 Time zones with Luxon behind one resolver

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: plan D3, D16; WBS 5.1, 5.2; risk R6

## Context and problem

Provider time zones are free text: an IANA name, an old alias with a trailing space ("Asia/Katmandu "), offsets in two formats (" UTC+05:45", "(GMT+5:45)"), a Windows name ("Nepal Standard Time") and an empty string. `Intl` throws on unknown zone names. Slots are wall-clock times in the provider's zone, shown beside the customer's own time, and "today" is judged by the provider's clock.

## Options considered

1. Luxon, with our own `resolveTimeZone` in front of it
2. date-fns with date-fns-tz
3. The Temporal API through a polyfill

## Decision

Option 1. `resolveTimeZone(raw, country)` trims, then tries IANA, an alias map, a Windows-name map, offset parsing, and finally the country's zone. It returns the zone and which source was used. Only resolved zones reach Luxon. Logic that needs "now" takes it as an argument.

## Consequences

- Good: one API for IANA zones and fixed offsets, and readable code to walk through live.
- Good: every stored value has a test row, and the source is logged.
- Cost: one dependency; Temporal would be the long-term native choice once it is widely available.
- References: https://moment.github.io/luxon/, https://www.iana.org/time-zones, https://github.com/unicode-org/cldr/blob/main/common/supplemental/windowsZones.xml
