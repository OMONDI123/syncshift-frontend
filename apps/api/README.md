# apps/api (Phase 2 — not yet built)

This will be the Spring Boot 3.5 / Java 21 backend, backed by PostgreSQL, that the
`apps/web` frontend is already shaped to talk to:

- Every store in `apps/web/src/store/*` isolates its mock logic behind the same methods
  a real API client would expose (`assignUser`, `requestSwap`, `managerApprove`, …) —
  swapping in HTTP calls means editing the store internals, not the components.
- `apps/web/src/lib/realtime.ts` is built to the STOMP-over-SockJS topic shape this
  service will expose: `/topic/locations/{id}/schedule`, `/topic/users/{id}/notifications`,
  `/topic/locations/{id}/presence`.
- `apps/web/src/lib/constraints.ts` is the client-side mirror of the server-side
  constraint engine that will live here — the backend is the source of truth and the
  frontend copy exists only for instant UI feedback before a round trip.

Planned modules once this phase starts: `auth`, `scheduling` (shifts, constraint engine,
audit log), `swaps`, `notifications`, `presence` (WebSocket), all behind a `postgres`
service defined in the root `docker-compose.yml`.
