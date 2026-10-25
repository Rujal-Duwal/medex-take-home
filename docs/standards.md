# Standards and references

The standards this project follows, with the official source for each. When you implement one of these patterns, read the linked page first instead of relying on memory, and cite the page in a code comment where the choice is not obvious.

If a link is dead, search for the page title on the same site. Do not switch to a blog post when an official source exists.

## Architecture and decisions

| Standard | Used for | Link |
|---|---|---|
| Architecture Decision Records (Nygard) | Why we write ADRs | https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions |
| MADR (Markdown ADR template) | Format of `docs/adr/*.md` | https://adr.github.io/madr/ |
| ADR overview | Background and tooling | https://adr.github.io/ |
| C4 model | Levels used in `docs/ARCHITECTURE.md` (context, containers, components) | https://c4model.com/ |
| Statecharts | Checkout and booking state machines | https://statecharts.dev/ |

## Framework and language

| Standard | Used for | Link |
|---|---|---|
| Next.js App Router | Routing, layouts, server components | https://nextjs.org/docs/app |
| Next.js `page` file and `searchParams` | Server render from the URL (Task 1) | https://nextjs.org/docs/app/api-reference/file-conventions/page |
| Next.js route handlers | Mock API endpoints | https://nextjs.org/docs/app/api-reference/file-conventions/route |
| Next.js `headers` config | Security headers | https://nextjs.org/docs/app/api-reference/config/next-config-js/headers |
| Next.js fonts | IBM Plex Sans, self-hosted | https://nextjs.org/docs/app/getting-started/fonts |
| React `useDeferredValue` | Typing never blocks (Task 1) | https://react.dev/reference/react/useDeferredValue |
| React `useTransition` | Non-urgent updates | https://react.dev/reference/react/useTransition |
| TypeScript compiler options | `strict`, `noUncheckedIndexedAccess` | https://www.typescriptlang.org/tsconfig/ |

## Styling and design system

| Standard | Used for | Link |
|---|---|---|
| Tailwind CSS theme variables (v4) | Tokens as CSS variables | https://tailwindcss.com/docs/theme |
| shadcn/ui with Tailwind v4 | Component setup and theming | https://ui.shadcn.com/docs/tailwind-v4 |
| Radix Primitives | Accessible dialog, drawer, checkbox, combobox building blocks | https://www.radix-ui.com/primitives/docs/overview/introduction |
| Design Tokens Community Group | How tokens are named and layered | https://www.designtokens.org/ |

## Accessibility

| Standard | Used for | Link |
|---|---|---|
| WCAG 2.2 (target level AA) | The bar for every screen | https://www.w3.org/TR/WCAG22/ |
| ARIA Authoring Practices Guide (APG) | Keyboard and role patterns | https://www.w3.org/WAI/ARIA/apg/ |
| APG grid pattern | Calendar and slot grid arrow keys (Task 3) | https://www.w3.org/WAI/ARIA/apg/patterns/grid/ |
| APG date picker example | Calendar keyboard model (Task 3) | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/ |
| APG combobox pattern | Searchable provider filter (Task 1) | https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ |
| APG dialog (modal) pattern | Filter drawer, compare view, confirm steps | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ |
| MDN ARIA live regions | Result count and status announcements | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_live_regions |

## Money, time and data formats

| Standard | Used for | Link |
|---|---|---|
| ISO 4217 currency codes | THB, NPR, INR | https://www.iso.org/iso-4217-currency-codes.html |
| `Intl.NumberFormat` | Formatting money per currency | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat |
| big.js | Exact decimal maths | https://mikemcl.github.io/big.js/ |
| IANA time zone database | Canonical zone names (Asia/Kathmandu, not Asia/Katmandu) | https://www.iana.org/time-zones |
| CLDR Windows zone mapping | "Nepal Standard Time" to an IANA zone | https://github.com/unicode-org/cldr/blob/main/common/supplemental/windowsZones.xml |
| Luxon | Zone handling and wall-clock maths | https://moment.github.io/luxon/ |

## APIs and reliability

| Standard | Used for | Link |
|---|---|---|
| IETF Idempotency-Key header (draft) | Checkout retries without duplicates (Task 2) | https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ |
| Stripe idempotent requests | A well-known real-world reference | https://docs.stripe.com/api/idempotent_requests |
| HTTP status codes (MDN) | 402, 409, 500 meanings in the mock | https://developer.mozilla.org/en-US/docs/Web/HTTP/Status |
| `navigator.onLine` | Offline state | https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine |

## Security

| Standard | Used for | Link |
|---|---|---|
| OWASP Top 10 | General web risks to keep in mind | https://owasp.org/www-project-top-ten/ |
| OWASP HTTP security headers cheat sheet | Header values in `next.config` | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html |
| OWASP Secure Headers Project | Background on each header | https://owasp.org/www-project-secure-headers/ |

## Performance

| Standard | Used for | Link |
|---|---|---|
| Interaction to Next Paint (INP) | Filter change responsiveness (Task 1) | https://web.dev/articles/inp |
| Cumulative Layout Shift (CLS) | No layout shift on updates | https://web.dev/articles/cls |
| web-vitals library | Measuring INP and CLS in the browser | https://github.com/GoogleChrome/web-vitals |

## Testing and workflow

| Standard | Used for | Link |
|---|---|---|
| Vitest | Unit tests and benchmarks | https://vitest.dev/guide/ |
| Testing Library guiding principles | Test what the user sees, not internals | https://testing-library.com/docs/guiding-principles |
| React Testing Library | Component tests | https://testing-library.com/docs/react-testing-library/intro/ |
| Conventional Commits 1.0.0 | Commit message format | https://www.conventionalcommits.org/en/v1.0.0/ |
| Google code review practices | How Rujal reviews each diff | https://google.github.io/eng-practices/review/ |

## UX

| Standard | Used for | Link |
|---|---|---|
| Nielsen's 10 usability heuristics | Visibility of status, error recovery, plain language | https://www.nngroup.com/articles/ten-usability-heuristics/ |
| Skeleton screens (NN/g) | Loading states instead of spinners | https://www.nngroup.com/articles/skeleton-screens/ |

## Privacy and compliance (context only)

All data in this project is fictional and nothing personal is stored or sent anywhere. These apply to a real MedEx build and are mentioned in the README's compliance note, not implemented here:

- Thailand: Personal Data Protection Act B.E. 2562 (2019)
- India: Digital Personal Data Protection Act, 2023
- Nepal: Individual Privacy Act, 2075 (2018)
- Accessibility: WCAG 2.2 AA, as above
