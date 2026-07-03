# Restaurant Reservation Management System — Execution Plan

## 1. Goal Restated

Build a full-stack reservation system (React + Node/Express + MongoDB + JWT) with two roles (Customer, Admin), correct double-booking/capacity logic, role-based views, and a public deployment — in 48 hours. The rubric weighs **conflict handling** and **role-based access** most heavily, so those get built and tested first, polish comes last.

---

## 2. Tech Stack Decisions (lock these in now, don't relitigate later)

| Layer            | Choice                                                       | Why                                                                    |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Frontend         | React (Vite) + React Router + Axios                          | Fast setup, no CRA overhead                                            |
| Styling          | Plain CSS or Tailwind                                        | Spec says visual design isn't graded — pick whichever you're faster in |
| Backend          | Node.js + Express                                            | Required                                                               |
| DB               | MongoDB (Atlas free tier) + Mongoose                         | Required, gives schema validation                                      |
| Auth             | JWT (access token only, no refresh token complexity)         | "JWT or equivalent" — keep it simple                                   |
| Password hashing | bcrypt                                                       | Standard                                                               |
| Validation       | express-validator or Zod                                     | Centralized input validation                                           |
| Deployment       | Backend: Render/Railway. Frontend: Vercel/Netlify. DB: Atlas | Free tiers, reliable                                                   |

**Decision to document in README:** single restaurant, fixed seed of tables, no payments/notifications (explicitly out of scope per spec).

---

## 3. Data Model

### User

```
{
  name: String, required
  email: String, required, unique
  password: String, required (hashed)
  role: String, enum ["customer", "admin"], default "customer"
  createdAt: Date
}
```

### Table

```
{
  tableNumber: Number, required, unique
  capacity: Number, required
  isActive: Boolean, default true   // for soft-disable instead of delete
}
```

### Reservation

```
{
  user: ObjectId -> User, required
  table: ObjectId -> Table, required
  date: String ("YYYY-MM-DD"), required        // store as string or Date-at-midnight-UTC, be consistent
  timeSlot: String (e.g. "19:00-20:30") OR { start: String, end: String }
  guests: Number, required
  status: String, enum ["confirmed", "cancelled"], default "confirmed"
  createdAt: Date
}
```

**Key design decision:** Model time slots as **fixed enumerable slots** (e.g. 1-hour blocks: 12:00-13:00, 13:00-14:00 … 22:00-23:00) rather than free-form time ranges. This makes conflict-checking a simple equality query instead of interval-overlap math, which is both easier to get right in 48 hours and easier for an evaluator to verify. Document this as an assumption.

---

## 4. Core Business Logic (the part that's actually graded hardest)

### Availability rule

A table is unavailable for a given `date + timeSlot` if there's already a `confirmed` reservation for that exact `table + date + timeSlot`.

**Booking endpoint algorithm:**

1. Validate input (date not in past, guests > 0, valid slot format).
2. Find all tables with `capacity >= guests` and `isActive: true`.
3. Of those, exclude tables that already have a `confirmed` reservation for that `date + timeSlot`.
4. If none remain → 409 Conflict, "No tables available for this slot."
5. If the request specifies a preferred table → check only that table's availability; if taken, return 409 with a clear message (don't auto-substitute silently).
6. If no table specified → auto-assign the smallest capacity table that satisfies guest count (best-fit, avoids wasting large tables on small parties).
7. Create reservation inside a **MongoDB transaction** (or at minimum a re-check-then-write pattern) to reduce race conditions on double booking.

### Concurrency note (mention in README as a known limitation if you skip full transactions)

Two simultaneous requests for the same table/slot is the classic race condition. Options, in order of effort:

- **Minimal:** re-check availability immediately before insert (small race window remains — acceptable to disclose as a known limitation).
- **Better:** unique compound index on `{ table, date, timeSlot, status: "confirmed" }` (partial index) — DB itself rejects the duplicate, which is the cleanest fix and cheap to add.
- **Best (optional):** Mongo session transactions.

Recommendation: do the **unique partial index** — it's ~10 minutes of work and closes the race condition properly. This alone is a strong signal to evaluators.

### Cancellation rule

- Customers can cancel only their own reservations, and only if `status: confirmed`.
- Admin can cancel/update any reservation.
- Cancelling sets `status: cancelled` (soft delete) — frees the slot for others automatically since the availability query only checks `confirmed`.

---

## 5. API Design

Base: `/api`

### Auth

| Method | Route          | Access        | Purpose                                                                           |
| ------ | -------------- | ------------- | --------------------------------------------------------------------------------- |
| POST   | /auth/register | Public        | Create user (role defaults to customer; do not allow client to self-assign admin) |
| POST   | /auth/login    | Public        | Returns JWT                                                                       |
| GET    | /auth/me       | Authenticated | Return current user profile/role                                                  |

### Tables

| Method | Route       | Access        | Purpose                       |
| ------ | ----------- | ------------- | ----------------------------- |
| GET    | /tables     | Authenticated | List tables (for booking UI)  |
| POST   | /tables     | Admin         | Create table                  |
| PUT    | /tables/:id | Admin         | Update capacity/active status |
| DELETE | /tables/:id | Admin         | Soft-disable table            |

### Reservations

| Method | Route                                              | Access                       | Purpose                                |
| ------ | -------------------------------------------------- | ---------------------------- | -------------------------------------- |
| GET    | /reservations/availability?date=&timeSlot=&guests= | Authenticated                | Return available tables                |
| POST   | /reservations                                      | Customer                     | Create reservation                     |
| GET    | /reservations/my                                   | Customer                     | Own reservations                       |
| PATCH  | /reservations/:id/cancel                           | Customer (own) / Admin (any) | Cancel                                 |
| GET    | /reservations                                      | Admin                        | All reservations                       |
| GET    | /reservations?date=YYYY-MM-DD                      | Admin                        | Filter by date                         |
| PATCH  | /reservations/:id                                  | Admin                        | Update (date/slot/table/guests/status) |

### Status codes to actually use

- 200 success / 201 created / 400 validation error / 401 not authenticated / 403 wrong role / 404 not found / 409 conflict (double booking, capacity) / 500 unhandled.

### Centralized error handling

One Express error-handling middleware that returns a consistent shape:

```json
{ "success": false, "message": "...", "errors": [ ... optional field errors ... ] }
```

All routes `next(err)` into it instead of ad-hoc try/catch responses.

---

## 6. Auth & Role-Based Access

- JWT payload: `{ id, role }`, signed with `process.env.JWT_SECRET`, expiry ~1d.
- `authenticate` middleware: verifies token, attaches `req.user`.
- `authorize(...roles)` middleware: checks `req.user.role` is in allowed list, else 403.
- Apply `authorize("admin")` to all admin-only routes.
- Frontend: store JWT in memory/localStorage, decode role client-side only for **UI routing** (show/hide nav) — never trust client-side role checks for security, backend must enforce it independently.
- Protected routes in React via a `<ProtectedRoute role="admin">` wrapper component.

---

## 7. Frontend Structure

```
src/
  api/            axios instance + endpoint functions
  context/        AuthContext (user, token, login/logout)
  components/
    common/        Navbar, ProtectedRoute, ErrorAlert
    customer/       ReservationForm, MyReservations, ReservationCard
    admin/          AllReservations, ReservationFilters, TableManager
  pages/
    Login.jsx, Register.jsx
    CustomerDashboard.jsx
    AdminDashboard.jsx
  App.jsx           routes
```

### Customer flow

1. Login/Register → redirected to Customer Dashboard.
2. "New Reservation" form: pick date, time slot (dropdown of fixed slots), guests → calls availability endpoint → shows available tables or "no availability" message.
3. Confirm → POST reservation → show success/conflict error clearly.
4. "My Reservations" list with Cancel button (disabled if already cancelled).

### Admin flow

1. Distinct layout/color or header badge ("Admin Panel") so it's visually unmistakable.
2. Table of all reservations, filter by date, columns for user/table/slot/guests/status.
3. Cancel or edit any reservation inline.
4. (Optional, if time remains) Manage Tables CRUD screen.

---

## 8. Execution Plan (build order, not time-boxed)

Work in this order — each phase depends on the one before it, and the reservation-logic phase is the one to slow down for, since it's the highest-weighted rubric item.

**Phase 1 — Setup**

- Init repo (monorepo or two folders: `/server`, `/client`), git init, `.gitignore`, `.env.example`.
- Express server skeleton, Mongo connection (Atlas), health check route.
- Vite React app skeleton, routing shell.

**Phase 2 — Auth**

- User model, register/login/me endpoints, bcrypt, JWT issue/verify middleware, authorize middleware.
- React AuthContext, Login/Register pages, protected routing.

**Phase 3 — Table model + seed script**

- Table schema, a `seed.js` script creating ~6–8 tables of varying capacity.
- GET /tables endpoint, admin CRUD (can be quick).

**Phase 4 — Reservation core logic (the critical path)**

- Reservation schema + unique partial index for conflict prevention.
- Availability endpoint (capacity filter + slot conflict filter).
- Create reservation endpoint (auto-assign or specified table, transaction/re-check).
- My reservations + cancel endpoint.
- **Run the manual test cases in §9 before moving on** — don't proceed to the frontend until double-booking, capacity, and cancellation-frees-slot are all confirmed working.

**Phase 5 — Admin reservation endpoints**

- GET all / by date, PATCH update, PATCH cancel-any.

**Phase 6 — Frontend: customer flow**

- Reservation form wired to availability + create endpoints.
- My reservations list + cancel.
- Error message surfacing (409s shown as friendly text, not raw JSON).

**Phase 7 — Frontend: admin flow**

- All reservations table, date filter, cancel/update actions.
- Visual distinction from customer view.

**Phase 8 — Validation & error handling pass**

- Centralized error middleware, express-validator on all inputs, edge cases (past dates, guests <= 0, invalid slot, nonexistent table).

**Phase 9 — Deployment**

- Backend to Render/Railway with env vars set there (not in repo).
- Frontend to Vercel/Netlify, pointed at deployed backend URL via env var.
- Smoke-test the live URL end-to-end as both roles.

**Phase 10 — README + polish**

- Write README (see §10).
- Clean up console logs, commit history sanity check, final walkthrough as both customer and admin.

**Phase 11 — Buffer**

- Reserve time for whatever broke during deployment or last-minute edge cases. Don't schedule real feature work here.

---

## 9. Minimum Test Cases to Manually Verify Before Moving On (don't skip)

1. Book a table → book the **same table/date/slot** again → expect 409, not a duplicate reservation.
2. Book with guests > every table's capacity → expect 400/409 with clear message, no crash.
3. Two different time slots, same table, same date → both succeed.
4. Cancel a reservation → confirm the slot becomes bookable again.
5. Customer A cannot see or cancel Customer B's reservation (403/404).
6. Non-admin hitting an admin route → 403.
7. Expired/missing/malformed JWT → 401, not a 500.
8. Admin cancels a customer's reservation → customer's "my reservations" reflects it.

---

## 10. README.md Checklist (required for submission)

- [ ] Setup instructions (env vars needed, how to run server + client locally, how to run seed script)
- [ ] Assumptions made (single restaurant, fixed slots, table seeding, etc.)
- [ ] Explanation of reservation/availability logic (reference the algorithm in §4)
- [ ] Explanation of role-based access (User vs Admin — what each can/can't do, how it's enforced)
- [ ] Known limitations (e.g., partial-index-only concurrency protection, no timezone handling, no payments/notifications per spec)
- [ ] Areas for improvement with more time (transactions, waitlists, recurring reservations, etc.)
- [ ] Live deployment URL + GitHub repo link

---

## 11. Risk Areas / Where People Lose Points

- **Silent double bookings** under concurrent requests — mitigate with the unique partial index (§4), it's cheap insurance.
- **Client-side-only role checks** — always double-enforce on the backend.
- **Secrets committed to git** — use `.env` + `.gitignore`, provide `.env.example` only.
- **Deployment rot** — redeploy and click through the live URL right before submitting; free-tier services sometimes sleep/spin down, mention cold-start behavior in README if using Render free tier.
- **Vague error messages** — "Something went wrong" everywhere is a red flag; be specific (e.g., "This table is already booked for the selected time slot").
