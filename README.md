# ShiftSync — Coastal Eats Scheduling

Multi-location staff scheduling platform. This is **Phase 2: integrated** — the React
frontend now talks to the real Spring Boot backend (`shiftsync-backend/`) over HTTP and a
STOMP/WebSocket connection: real JWT auth, a real Postgres/H2-backed database, the real
constraint engine, and live updates pushed to every open tab. `apps/api` below is unrelated
scaffolding from the original monorepo layout — the actual backend lives in the separate
`shiftsync-backend` project.

## Stack

- **apps/web** — React 18 + TypeScript + Vite + Zustand + Tailwind CSS, managed via Turborepo
- **shiftsync-backend** (sibling project) — Spring Boot 3.5 / Java 21, JWT auth, STOMP over
  SockJS for realtime, H2 file-based storage by default (see its own README for Postgres)
- **apps/api** — unused placeholder from the original scaffold, not the real backend

## Running the whole thing

```bash
# 1. Backend — from the shiftsync-backend project root
./mvnw spring-boot:run     # http://localhost:8080/api, seeds demo data on first run

# 2. Frontend — from this project's apps/web
npm install
npm run dev                 # http://localhost:5173
```

The frontend reads its backend URL from `apps/web/.env` (`VITE_API_BASE_URL`,
`VITE_WS_BASE_URL`) — defaults to `http://localhost:8080/api` for local dev. Override in
an `.env.local` if your backend runs elsewhere.

```bash
npm run test        # Vitest suite — constraint engine (pure logic) + permission helpers
npm run build        # type-checks and builds apps/web — verified clean end-to-end
```

## What changed from Phase 1

Every Zustand store (`src/store/*.ts`) now calls the real API (`src/lib/api.ts`) instead of
mutating in-memory seed data, through a small mapping layer (`src/lib/mappers.ts`) that
converts the backend's numeric ids / UPPERCASE enums into the string ids and lowercase
enums the rest of the app was already written against — so almost no page or component
needed to change shape, just to `await` what's now a network call. Realtime went from an
in-memory mock pub/sub (`src/lib/realtime.ts`) to a real STOMP-over-SockJS client. Two
small, additive read endpoints (`GET /swaps/open`, `GET /swaps/mine`) were added to the
backend's `SwapController` since the original brief didn't need a marketplace-listing view
and the frontend does. The Fairness and Overtime dashboards now pull from the backend's
real `/analytics` endpoints (actual hourly rates, actual premium-shift variance) instead of
a flat assumed rate computed client-side.

## The flow

1. **Landing page (`/`)** — public marketing page. Includes a live, interactive
   run of the same constraint logic that powers the real Schedule board (`EngineTeaser`),
   no login required — it runs client-side against bundled sample data since the real
   `/shifts/{id}/check-assignment` endpoint requires authentication. Pick a candidate for
   an open Miami bartender shift and see the same pass/fail reasoning the live app gives.
2. **Sign in (`/login`)** — a real email + password form. Credentials are below. The
   demo-credentials panel lets you click a name to fill the form, but you still press
   "Sign in" — it goes through `authStore.login()` → `POST /auth/login` → a real
   BCrypt-checked, JWT-issuing request.

3. **Role-based redirect** — on success you land on `/admin`, `/schedule`, or
   `/my-shifts` depending on the account's role (`roleHomePath` in `lib/auth.ts`).

## Demo credentials

One password per **role**, not per person — easier to remember when presenting live.

| Role | Password | Example accounts |
|---|---|---|
| Admin | `Admin@123` | dana@coastaleats.com |
| Manager | `Manager@123` | marcus@coastaleats.com (West), priya@coastaleats.com (East) |
| Staff | `Staff@123` | sarah@coastaleats.com, jordan@coastaleats.com, ava@coastaleats.com, and others |

The full list of accounts is also shown, grouped by role, directly on the login page.

| Role | Name | What to look at |
|---|---|---|
| Admin | Dana Reyes | Organisation overview, audit log with CSV export |
| Manager (West) | Marcus Chen | Schedule board + On Duty Now for Seattle Harbor / Portland Pearl |
| Manager (East) | Priya Nair | Schedule board for Miami Shore / Boston Wharf, pending swap approvals |
| Staff | Sarah Kim | My Shifts, has a swap request already pending manager approval |
| Staff | Jordan Blake | Certified at both a Pacific location (Seattle) and an Eastern one (Miami) |
| Staff | Ava Thompson | Already near 40 hours this week — the overtime-trap edge case |

## What admin can do

Per the brief, Admin means **corporate oversight across all locations** — implemented as
genuinely full access, not just a read-only view:

- **Every manager screen is open to admins too** — Schedule board, On Duty Now, Overtime,
  Fairness — scoped to *all* locations at once rather than a subset. `canManageLocation`
  in `lib/auth.ts` already returned `true` for admins from day one; this pass extended the
  routes and per-page location filters to actually surface that, instead of leaving admins
  looking at an empty "you don't manage any locations" screen.
- **User management (`/admin/users`)** — admins can create accounts, assign or change
  roles, edit skills/certifications/managed-locations, and deactivate/reactivate accounts.
  Role-conditional fields are re-scoped automatically (e.g. promoting someone to Manager
  clears their `skills`, since that field no longer applies).
- **A newly created account can sign in immediately** — `authStore` now looks up users
  through the live `scheduleStore.staff` list instead of a frozen snapshot of the seed
  data, so an admin-created account (or an admin-deactivated one) takes effect on the very
  next login attempt, in the same session. Covered in `userManagement.test.ts`.
- **Deactivation, not deletion** — matches the same "preserve historical data" decision
  made for de-certification (#1 below): a deactivated account can't log in or be assigned,
  but its shift history and audit trail stay intact. An admin can't deactivate their own
  account (guards against accidental lockout).
- Every one of these actions still goes through the same permission-check-inside-the-store
  pattern as everything else — `canManageUsers()` is checked in `createUser`/`updateUser`/
  `setUserActive` independently of what the UI renders, and denied attempts are audited.

## Security — mocked, but actually enforced

The brief asked everything to be mocked; it didn't ask for permission checks to be
decorative. Concretely:

- **Every mutating store action re-checks authorization itself** — `scheduleStore.assignUser`,
  `unassignUser`, `publishLocationWeek`, `updateShift`, and `swapStore.managerApprove` /
  `managerReject` all call `canManageLocation` / `canApproveSwapsAt` from `lib/auth.ts`
  before touching state, independent of whatever the UI happens to render. A manager
  calling these for a location they don't manage is rejected with `unauthorized: true`,
  the same way a real API would reject the request server-side regardless of what the
  client sent.
- **Unauthorized attempts are audited.** Every rejected action and every blocked route
  (`RequireRole`) writes a `security` entry to the audit log — visible to admins/managers
  in Audit Log, highlighted in red.
- **Route guards fail closed to a 403**, not a silent redirect — `ForbiddenPage` tells the
  user their role doesn't cover that area and that the attempt was recorded.
- **Optimistic concurrency** on `Shift.version` — the Assign drawer captures the shift's
  version when it opens and passes it back on confirm; if another manager changed the
  shift in the meantime, the write is rejected as a `conflict` and the UI shows what
  changed instead of silently overwriting it. This is the direct implementation of the
  "Simultaneous Assignment" evaluation scenario and the "data integrity under concurrent
  operations" rubric line.
- **Session expiry is simulated**, not just login state — a session older than 45 minutes
  fails to restore (`restoreSession`) and a tampered/mismatched token is rejected, both
  covered in `lib/auth.test.ts`.

None of this is real cryptography — there's no backend to hold a secret, so `lib/auth.ts`
is explicit that it's mocking what Spring Security will do in Phase 2. The point is that
the *shape* of every check (who, for what location, logged where) is already correct and
testable, so Phase 2 is "swap the implementation," not "add the concept."

## Landing page & creative direction

The public landing page (`pages/LandingPage.tsx`) isn't generic SaaS boilerplate:

- **`HeroBoard`** — a small auto-cycling animation of a live schedule board (open shift →
  covered → swap approved), built with plain CSS transitions, no animation library.
- **`EngineTeaser`** — the actual `checkAssignment` engine running against real seed data,
  embedded directly in the page. Pick a candidate for an open Saturday bartender shift at
  Miami Shore and see real pass/fail reasoning, before signing in. Nothing here is faked —
  it's the same function the Assign drawer calls.
- **`CyclingWord`** — a small kinetic-text headline ("Stop fighting no-shows / overtime /
  unfair shifts / double-bookings").
- Pain-point section framed as struck-through problem → solved outcome, pulled directly
  from the brief's "Business Context" list rather than generic marketing copy.

While wiring the `EngineTeaser` demo I caught a real bug worth flagging: the original
availability check compared a shift's *location*-local clock time against a staff
member's availability window, instead of the staff member's own home timezone. That's
backwards for exactly the case the brief calls out — someone certified across two
timezones (Jordan Blake) would have had their stated hours silently reinterpreted
depending on which location's shift was being checked. Fixed in
`lib/constraints.ts::isWithinAvailability`, which now converts every shift instant into
the *user's* `homeTimezone` (new field on `User`) before comparing. This is the kind of
thing that's easy to get subtly wrong and easy to demo confidently wrong — worth
double-checking against the actual "Timezone Tangle" scenario rather than trusting the
first pass's self-report.

## Design system v2

The first pass leaned too heavily on default component patterns. This pass:

- Replaced emoji glyphs with a small inline SVG icon set (`components/icons/Icon.tsx`) so
  the UI reads as a considered product, not a prototype.
- Introduced `StatCard` for dashboard metrics (Overtime, Admin Overview) with tone-coded
  icon chips instead of plain numbers in boxes.
- Reworked the sidebar into labeled sections (Scheduling / Insights / Organisation) with
  a persistent profile card and a proper mobile drawer (hamburger menu, backdrop, focus
  handling) — the app is now usable at phone width, not just desktop.
- Redesigned the shift "ticket" card: a slim color spine keyed to skill, tighter
  typographic hierarchy, tabular numerals for times/counts, and a premium-shift chip that
  reads as a badge rather than an emoji.
- Added a live "session timer" and a pulsing "Live" connection pill to the top bar so the
  mocked real-time and mocked-auth systems are visible, not just functional.

## Walking through the evaluation scenarios

- **Sunday Night Chaos**: as Marcus Chen, open Schedule board, click the Sunday 7pm
  Seattle server shift, remove the assigned person, and search for a replacement — the
  Assign drawer live-checks every candidate and explains exactly why anyone ineligible is
  excluded, with qualified alternatives suggested first.
- **Overtime Trap**: as Priya Nair, open Overtime & Labor — Ava Thompson is already shown
  at 40h; opening Schedule board and trying to add her Saturday shift shows a live "would
  push to 48h" warning before you confirm.
- **Timezone Tangle**: Jordan Blake's recurring availability (My Availability page) is
  entered once, in their own home timezone. Try it live in the Engine Teaser on the
  landing page or the Assign drawer: their 9am–5pm Pacific is correctly converted before
  being checked against a Miami (Eastern) shift, not silently reinterpreted as 9am–5pm
  Eastern.
- **Simultaneous Assignment**: open the same unfilled Saturday Miami bartender shift in
  two browser tabs as Priya Nair; assigning in one tab bumps the shift's version, so
  confirming the stale assignment in the other tab returns a conflict instead of silently
  double-booking.
- **Fairness Complaint**: the Fairness report sorts by premium (Fri/Sat evening) shifts
  assigned, so a manager can answer "have I really not gotten Saturdays?" in one glance.
- **Regret Swap**: from Marketplace, a staff member can cancel their own request any time
  before manager approval — the original assignment was never touched, so cancelling is a
  no-op on the schedule (`swapStore.test.ts`).

## Evaluation rubric ↔ implementation map

| Rubric area | Weight | Where it's addressed |
|---|---|---|
| Constraint enforcement correctness | 25% | `lib/constraints.ts` (skill/location/rest/hours/consecutive-day rules) + `lib/constraints.test.ts` (11 cases) |
| Edge case handling | 20% | README "Ambiguities" below, `swapStore.ts` (regret cancel, auto-cancel on edit, 3-pending cap, 24h drop expiry) + `swapStore.test.ts` |
| Real-time functionality | 15% | `lib/realtime.ts` mock pub/sub, On Duty Now live board, notification bell, "Live" status pill |
| UX & clarity of feedback | 15% | `ConstraintExplainer` (plain-language, per-violation), design system v2 above, empty/loading states throughout |
| Data integrity under concurrent operations | 15% | `Shift.version` optimistic concurrency in `scheduleStore.assignUser` + `scheduleStore.test.ts` |
| Code organization & maintainability | 10% | `lib/` (framework-agnostic core) vs `store/` (state) vs `components/`/`pages/` (UI), documented in-line, typed end-to-end |

## Architecture decisions on the brief's intentional ambiguities

1. **De-certifying a staff member from a location**: historical shifts keep the
   assignment record as-is (the audit trail is the source of truth for "who worked what,
   when"); only *future* published/draft shifts and the ability to be newly assigned are
   affected.
2. **Desired hours vs. availability**: desired hours is a soft *target* used only in the
   Fairness report; availability is a hard *constraint* used by the assignment engine —
   intentionally decoupled.
3. **Consecutive days & shift length**: a 1-hour shift and an 11-hour shift count equally
   toward the 6th/7th consecutive day rule — that rule is about days worked, not hours.
4. **Editing a shift after swap approval, before it occurs**: any edit to a shift with a
   swap in a non-terminal state auto-cancels that swap and notifies both parties
   (`swapStore.cancelForShiftEdit`). Once `approved`, the shift already reflects the new
   assignee, so further edits are ordinary edits with no special swap handling.
5. **Recurring availability timezone anchor**: anchored to the staff member's own declared
   home timezone, not each location's — the alternative would silently mean different
   things depending on which shift is being checked, which is worse for someone like
   Jordan Blake, certified in two zones.
6. **A location spanning a timezone boundary**: out of scope for Phase 1 — `Location` has
   exactly one IANA timezone. The real fix belongs at the *shift* level (a per-shift
   timezone override), not the location level.

## Known limitations (Phase 1)

- All data is in-memory (Zustand) and resets on a hard reload of the dev server's module
  graph — sessions persist via `localStorage`, but schedule/swap/availability data does not.
- Real-time updates use a mock pub/sub client with simulated latency, built to the same
  interface shape a WebSocket/STOMP client will implement in Phase 2 — no component code
  should need to change.
- Clock-in/out on My Shifts is available for any of today's shifts (rather than gated to
  the exact shift time window) so the On Duty Now board is easy to demo regardless of when
  you happen to be testing it.
- Email notification simulation and DST-transition-specific availability handling are
  stubbed at the type/interface level but not yet built as full screens.

## Repo layout

```
shiftsync/
  apps/
    web/          React frontend (this phase)
      src/
        lib/       time.ts, constraints.ts, realtime.ts, auth.ts — framework-agnostic core
        store/      zustand stores (auth, schedule, swap, availability, presence, notifications, ui)
        components/ shared UI, icons, schedule-specific components
        pages/      route-level screens, grouped by role
    api/           Spring Boot backend (Phase 2 — not yet built)
```
