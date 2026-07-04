# Restaurant Reservation Management Documentation

**Project:** Restaurant Reservation Management System ("Harshu's Kitchen")
**Audience:** Reviewers, maintainers, and contributing engineers
**Companion to:** [`README.md`](README.md) — this document expands on **code quality** and **documentation clarity**, the two dimensions that govern how the system is built and explained.

> **Purpose of this document.** The `README` tells you _how to run and use_ the system.
> This document explains _how the system is engineered and documented_ — the conventions,
> guardrails, and rationale a reviewer needs to assess maintainability and correctness
> without reading every file.

---

## 1. Document Scope

| Section                                           | Answers                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| [Codebase Organization](#2-codebase-organization) | How is the code laid out, and why?                        |
| [Code Quality](#3-code-quality)                   | What practices keep the code correct, readable, and safe? |
| [Documentation Clarity](#4-documentation-clarity) | How is the project explained to its readers?              |
| [Conventions Reference](#5-conventions-reference) | The naming and structural rules, at a glance.             |
| [Verification](#6-verification)                   | How correctness is demonstrated.                          |
| [Extending the System](#7-extending-the-system)   | How to add a feature without breaking the contract.       |

---

## 2. Codebase Organization

The repository is a two-package monorepo with a strict, one-directional dependency flow on
the backend. Each layer has a single responsibility and depends only on the layer beneath it.

```
Request
  │
  ▼
routes/          ── declare endpoints, attach validation + auth middleware
  │
  ▼
middleware/      ── authenticate → authorize → validate  (cross-cutting concerns)
  │
  ▼
controllers/     ── business logic; throw typed ApiError on failure
  │
  ▼
models/          ── Mongoose schemas, constraints, and the concurrency index
  │
  ▼
MongoDB
```

Cross-cutting helpers live in [`utils/`](server/src/utils/) (`ApiError`, `slots`), and every
error — from any layer — is normalized in one place ([`middleware/errorHandler.js`](server/src/middleware/errorHandler.js)).

**Why this matters for review:** a reviewer can predict where any concern lives. Validation
is never in a controller; error shaping is never in a route; the double-booking guard lives
with the data it protects. This predictability _is_ the maintainability story.

---

## 3. Code Quality

### 3.1 Separation of concerns

Each backend file does one job. Routes wire; middleware guards; controllers decide; models
persist. For example, [`reservationRoutes.js`](server/src/routes/reservationRoutes.js) is
purely declarative — it reads as a table of contents for the reservation API:

```js
router.use(authenticate);                       // every route is authenticated
router.get("/availability", getAvailability);   // any authenticated user
router.post("/", authorize("customer"), [ …validation… ], validate, createReservation);
router.get("/", authorize("admin"), listAllReservations);   // admin only
```

The access rules are visible at the routing layer, and the _why_ (ownership nuances) is
enforced deeper, in the controller — never duplicated.

### 3.2 Defense-in-depth validation

Input is validated at **three independent layers**, so no single missed check is fatal:

| Layer           | Mechanism                                                                    | Example                                          |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **Edge**        | `express-validator` chains + [`validate`](server/src/middleware/validate.js) | `body("guests").isInt({ min: 1 })`               |
| **Domain**      | Explicit checks in controllers using [`slots.js`](server/src/utils/slots.js) | `isValidSlot`, `isValidDateString`, `isPastDate` |
| **Schema / DB** | Mongoose `enum`/`min`/`match` + a partial unique index                       | `timeSlot: { enum: TIME_SLOTS }`                 |

The date validator even guards calendar rollovers (`2026-02-31` is rejected, not silently
coerced), which is the kind of edge case that separates correct-looking code from correct code.

### 3.3 A single, predictable error contract

Every failure funnels through [`errorHandler.js`](server/src/middleware/errorHandler.js) and
emerges in **one shape**:

```json
{
  "success": false,
  "message": "…",
  "errors": [{ "field": "…", "message": "…" }]
}
```

The handler translates infrastructure errors into honest HTTP semantics rather than leaking
`500`s:

| Source error                              | Becomes | Rationale                                               |
| ----------------------------------------- | ------- | ------------------------------------------------------- |
| Mongoose `ValidationError`                | `400`   | Field-level detail returned to the client               |
| Duplicate key (`11000`)                   | `409`   | The confirmed-booking index, or a duplicate email/table |
| `CastError` (bad ObjectId)                | `400`   | A malformed id is a client error, not a server fault    |
| `JsonWebTokenError` / `TokenExpiredError` | `401`   | Auth failures never surface as `500`                    |

Errors are modeled explicitly with [`ApiError`](server/src/utils/ApiError.js), a typed class
with factory methods (`ApiError.notFound()`, `ApiError.conflict()`, …) and an `isOperational`
flag that distinguishes expected failures from genuine bugs. Only `5xx` faults are logged.

### 3.4 Correctness under concurrency

Double-booking is prevented at the **database layer**, not merely in application code
([`models/Reservation.js`](server/src/models/Reservation.js)):

```js
reservationSchema.index(
  { table: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: "confirmed" } },
);
```

A pre-insert availability check gives friendly UX, but the **partial unique index is the
authoritative guard** — it closes the race in which two simultaneous requests both pass the
check. Because the filter is scoped to `status: "confirmed"`, cancelling a reservation frees
the slot automatically. This is _correct by construction_ rather than by careful timing.

### 3.5 Security posture (CIAM-appropriate defaults)

Security decisions are deliberate and centralized:

- **No hardcoded secrets, anywhere.** All credentials come from `process.env`. The seed
  script ([`seed.js`](server/src/seed.js)) reads `SEED_ADMIN_*` and **fails fast** if unset —
  no default admin password is baked in. Only `.env.example` (placeholders) is tracked.
- **Server-authoritative authorization.** [`authenticate`](server/src/middleware/auth.js)
  verifies the JWT and **re-loads the user** on every request, so a deleted account cannot
  keep acting on a stale token. `authorize(...roles)` gates admin routes.
- **Privilege escalation is impossible from the client.** Registration always sets
  `role: "customer"` server-side; any client-supplied `role` is ignored.
- **Enumeration-resistant ownership checks.** A customer touching another user's reservation
  receives `404`, not `403`, so IDs cannot be probed.
- **Passwords** are bcrypt-hashed via a model pre-save hook; **CORS** is restricted to an
  explicit `CLIENT_ORIGIN` allowlist.

> Client-side route guards (`<ProtectedRoute>`, role-based nav) are treated strictly as UX.
> Every request is independently authorized on the server.

### 3.6 Consistency and self-documenting names

Names describe intent, and patterns repeat verbatim across the codebase:

- Controllers are verb-led (`createReservation`, `listAllReservations`, `getAvailability`).
- Middleware is role-led (`authenticate`, `authorize`, `validate`).
- The reservation index is _named_ (`uniq_confirmed_table_slot`) so it is legible in Atlas.
- The frontend mirrors the backend contract: a single Axios instance
  ([`api/client.js`](client/src/api/client.js)) attaches the Bearer token via an interceptor
  and clears the session on `401`, so auth handling is defined once, not per-call.

### 3.7 Frontend quality

- **Design tokens over ad-hoc styles.** The theme is defined once in
  [`index.css`](client/src/index.css) as CSS custom properties; components consume utilities,
  so a palette change cascades to both the customer and admin views without edits.
- **Dependency-free icon set** ([`icons.jsx`](client/src/components/common/icons.jsx)) —
  inline SVGs inheriting `currentColor`, no icon-library dependency.
- **Focused components** grouped by audience (`components/{common,customer,admin}`), each with
  local state and clear props.

---

## 4. Documentation Clarity

### 4.1 The README answers the reviewer's questions in order

[`README.md`](README.md) is structured around the exact questions a reviewer asks, each a
first-class section: **Setup**, **Assumptions**, **Reservation & Availability Logic**,
**Role-Based Access**, **Testing**, **Deployment**, **Known Limitations**, and **Areas for
Improvement**. A table of contents links directly to each.

### 4.2 Prose is reinforced with rendered visuals

Explanations that are hard to convey in words are given as diagrams that render natively on
GitHub (validated against Mermaid v11):

- **Architecture** — SPA → API → Atlas, with the middleware chain.
- **Data model** — an ER diagram of `User`, `Table`, `Reservation`.
- **Booking flow** — a sequence diagram showing the `201` / `409` branch.
- **RBAC** — the `authenticate → authorize → ownership` decision flow with its `401/403/404`
  outcomes.

Real screenshots of the **live deployment** (sign-in and customer dashboard) sit under
[`docs/screenshots/`](docs/screenshots/), and a hand-built SVG banner
([`docs/banner.svg`](docs/banner.svg)) opens the document.

### 4.3 Inline documentation explains _why_, not _what_

Comments are used where they add signal — capturing rationale a future maintainer would
otherwise have to reverse-engineer. Representative examples:

- The `404`-not-`403` choice is annotated inline as an anti-enumeration measure.
- The partial unique index carries a paragraph explaining the concurrency guarantee.
- `slots.js` documents _why_ slots are a closed set (equality checks over interval math).

Every module and exported function that carries non-obvious behavior has a JSDoc block; the
error-middleware arity quirk is even called out with an explanatory `eslint-disable` note.

### 4.4 Configuration is self-documenting

[`server/.env.example`](server/.env.example) is a runnable specification of the environment:
each variable is commented with its purpose, marked required or optional, and carries an
obvious `<placeholder>` — never a real or copy-pasteable value. The README's env table mirrors
it exactly, including a **Required** column.

### 4.5 The API contract is documented once, precisely

The README's API summary tables every route with its method, path, and access level, and
states the shared error shape and the full set of status codes in use
(`200/201/400/401/403/404/409/500`). There is one source of truth for the contract.

---

## 5. Conventions Reference

| Concern          | Convention                            | Example                                |
| ---------------- | ------------------------------------- | -------------------------------------- |
| Controllers      | `camelCase`, verb-led                 | `createReservation`                    |
| Middleware       | `camelCase`, role/action-led          | `authenticate`, `authorize`            |
| Models           | `PascalCase` singular                 | `User`, `Table`, `Reservation`         |
| Dates            | `YYYY-MM-DD` strings                  | avoids timezone drift in slot equality |
| Errors           | typed `ApiError` + central handler    | `ApiError.conflict(msg)`               |
| API responses    | one shape, always                     | `{ success, message, errors? }`        |
| Secrets          | env-only, `.env.example` placeholders | `process.env.JWT_SECRET`               |
| Frontend styling | CSS custom-property tokens            | `--color-accent`, `bg-accent`          |
| Commits/branches | feature branch off `main`             | never commit secrets                   |

---

## 6. Verification

The backend was exercised against a live MongoDB with an end-to-end script covering the
required behaviors and their exact status codes:

- Double-booking → `409`; oversized party → `409`; same table across different slots → both
  succeed; cancel frees the slot; cross-customer isolation → `404`; non-admin on an admin
  route → `403`; missing/malformed JWT → `401`.
- A **concurrency race test**: 12 simultaneous identical bookings resolve to **exactly one
  `201` and eleven `409`s**, confirming the partial unique index holds under contention.

All Mermaid diagrams in the documentation were parsed with Mermaid v11 before commit, and both
screenshots were captured from the live production deployment.

---

## 7. Extending the System

The layering makes the "happy path" for a new feature explicit:

1. **Model** — add/adjust a schema in [`models/`](server/src/models/); express invariants as
   schema constraints or indexes, not controller checks.
2. **Validation** — add an `express-validator` chain in the route and, if domain-specific,
   a helper in [`utils/`](server/src/utils/).
3. **Controller** — implement the logic; throw `ApiError.*` on failure (never `res.status(...)`
   directly for errors — let the central handler shape the response).
4. **Route** — declare the endpoint and attach `authenticate` / `authorize` as needed.
5. **Client** — add an endpoint function to [`api/client.js`](client/src/api/client.js) and a
   focused component under the matching audience folder.
6. **Docs** — update the README's API table and, if the flow is non-trivial, the relevant
   diagram.

Following these steps keeps the error contract, the security model, and the documentation in
sync by construction.

---

<div align="center">

**Engineering Documentation** · maintained alongside the code · see [`README.md`](README.md) for setup and usage

</div>
