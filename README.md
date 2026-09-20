# ShiftSync — Multi-Location Staff Scheduling Platform

## The problem I set out to solve

I built ShiftSync as my solution to a Priority Soft full-stack take-home assessment: a
4-location, 2-timezone restaurant group ("Coastal Eats") needed a shift scheduling
system, and the brief asked for it to handle multi-location scheduling the way it
actually plays out in a real business — not as a schedule table with a calendar view
bolted on. This is the React frontend half of that submission. The problems I focused
on:

- **Real permission boundaries between roles.** I split the system into Admin
  (org-wide), Manager (their own locations only), and Staff (their own shifts and
  availability), and enforced every one of those boundaries server-side — a manager
  can't approve a swap at a location they don't run even if they call the API directly.
- **An actual constraint engine, not a form validator.** When I assign someone to a
  shift, I check skill match, location certification, availability (converted through
  the *staff member's own* timezone, not the shift's), minimum rest between shifts,
  daily/weekly hour limits, and 6th/7th-consecutive-day rules — and I surface a clear,
  human-readable reason for every block or warning, plus ranked suggestions for who
  could cover it instead.
- **A full shift-swap and open-drop workflow**, not just "reassign this shift." I let
  staff request a direct swap with a named colleague or drop a shift to an open
  marketplace, either path ending in a manager approval step, with automatic
  cancellation if the underlying shift changes underneath a pending request.
- **Live updates, not polling.** I push schedule changes, swap status, notifications,
  and clock-in/out presence over a WebSocket (STOMP/SockJS) connection to every open
  tab.
- **Manager analytics built on real numbers.** I compute fairness (premium-shift
  distribution) and overtime/labor-cost projections server-side from each person's
  actual hourly rate and actual assignment history, not a flat assumed rate.
- **A full audit trail.** I record every schedule change and every denied action,
  searchable by location and date range, and exportable to CSV.
- **Admin-configurable setup, not hardcoded config.** I made locations, the skills
  catalog, and the constraint engine's own thresholds (rest hours, daily/weekly limits,
  swap caps) editable at runtime by an Admin, so a scheduling rule can change without a
  redeploy.

I deliberately kept this scoped to "get the right person on the right shift, fairly and
within the rules, and let the schedule change safely" — I didn't try to make it a
payroll system, a POS integration, or a general-purpose HR tool.

## Stack — and why I chose it

| Choice | Why I chose it |
|---|---|
| **React 18 + TypeScript** | I wanted type safety end-to-end. The backend exposes typed DTOs, and mirroring those types on the frontend (`types/index.ts`, `lib/api.ts`) turns a contract mismatch into a compile error instead of a bug a user finds. |
| **Vite** | Near-instant HMR while I'm developing, and a fast, simple production build — I didn't want to maintain a webpack config for what is, underneath the domain complexity, a fairly standard SPA. |
| **Zustand** | The app's state naturally splits into independent domains — auth, schedule, swaps, availability, notifications, presence, settings. I gave each its own small, independently testable store instead of building one large Redux tree for what's really just "fetch this, mutate that, tell subscribers." |
| **Tailwind CSS** | I wanted the UI (spacing, color, type scale) consistent without hand-rolling a separate CSS architecture, and it made the small custom design system — shift "ticket" cards, tone-coded badges, stat cards — fast to iterate on. |
| **react-router-dom** | Standard, well-understood client routing; I paired it with a `RequireRole` guard component for role-based route protection. |
| **date-fns / date-fns-tz** | Lightweight, tree-shakeable, and — critically for this app — gave me correct, explicit timezone conversion. My "Timezone Tangle" scenario (a staff member certified across two timezones) depends on converting shift instants into the *staff member's own* home timezone before comparing against their availability, not the location's; date-fns-tz makes that conversion explicit and testable instead of relying on ambient `Date` behavior. |
| **@stomp/stompjs + sockjs-client** | I matched the backend's Spring WebSocket/STOMP setup directly, so real-time schedule, swap, notification, and presence updates are a genuine push connection authenticated with the same JWT as my REST calls — not a polling workaround. |
| **Vitest + React Testing Library** | Same tooling/config as Vite itself, fast, and enough for the two kinds of tests this project actually needs: pure business-logic tests (the constraint engine) and component-behavior tests. |
| **Turborepo** | Keeps my build/test/lint steps cached and fast, and leaves room for me to add another app (e.g. a slimmer admin-only bundle) later without restructuring. |

On the backend (Spring Boot 3.5, Java 21, JWT auth, Spring Data JPA, STOMP over
WebSocket, persisted to PostgreSQL), I kept the domain vocabulary identical to the
frontend's — enum values like `ViolationCode` and `Severity` match byte-for-byte on both
sides so the constraint engine reasons the same way wherever it runs.

## Getting started

You need the backend API and the frontend dev server running, plus a PostgreSQL
instance the backend can reach.

**Prerequisites:** Node.js 18+ and npm, Java 21, PostgreSQL 14+.

**1. Database**

```bash
createdb shiftsync
psql -d shiftsync -c "CREATE USER shiftsync WITH PASSWORD 'shiftsync';"
psql -d shiftsync -c "GRANT ALL PRIVILEGES ON DATABASE shiftsync TO shiftsync;"
```

**2. Backend**

```bash
cd shiftsync-backend
export SPRING_PROFILES_ACTIVE=prod
export DATABASE_URL=jdbc:postgresql://localhost:5432/shiftsync
export DATABASE_USERNAME=shiftsync
export DATABASE_PASSWORD=shiftsync
./mvnw spring-boot:run
```

Hibernate creates the schema automatically on first run (`ddl-auto: update`) and seeds
demo data unless you set `SEED_ENABLED=false`.

**3. Frontend**

```bash
cd shiftsync/apps/web
npm install
npm run dev
# → http://localhost:5173
```

The frontend only talks to `http://localhost:8080/api` — if you run the backend on a
different host/port, override it in `apps/web/.env.local`:

```bash
VITE_API_BASE_URL=http://your-host:8080/api
VITE_WS_BASE_URL=http://your-host:8080/api
```

**Tests / build**

```bash
cd shiftsync/apps/web
npm run test     # Vitest — constraint engine + permission-helper unit tests
npm run build    # tsc -b && vite build — full type-check + production build
```
