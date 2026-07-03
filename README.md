# Restaurant Reservation Management System

A full-stack restaurant reservation system with **role-based access** (Customer / Admin), robust **double-booking prevention**, and a clean React UI.

**Stack:** React (Vite) + React Router + Axios · Node.js + Express · MongoDB + Mongoose · JWT auth · bcrypt · express-validator.

```
restaurant_reservation/
├── server/            # Express + MongoDB REST API
│   ├── src/
│   │   ├── config/db.js
│   │   ├── models/            User, Table, Reservation
│   │   ├── middleware/        auth (authenticate/authorize), validate, errorHandler
│   │   ├── controllers/       auth, table, reservation
│   │   ├── routes/            auth, table, reservation
│   │   ├── utils/             slots (fixed time slots), ApiError
│   │   ├── seed.js            bootstrap admin + demo customer + tables
│   │   └── index.js / app.js
│   ├── .env.example
│   └── package.json
└── client/            # Vite React SPA
    ├── src/
    │   ├── api/client.js       axios instance + endpoint functions
    │   ├── context/AuthContext.jsx
    │   ├── components/{common,customer,admin}/
    │   ├── pages/              Login, Register, CustomerDashboard, AdminDashboard
    │   └── App.jsx
    ├── .env.example
    └── package.json
```

---

## 1. Setup & Run Locally

### Prerequisites
- Node.js 18+ (tested on Node 20)
- MongoDB running locally **or** a MongoDB Atlas connection string

### Backend
```bash
cd server
cp .env.example .env          # then edit values (see below)
npm install
npm run seed                  # creates admin + demo customer + 8 tables (idempotent)
npm start                     # http://localhost:5001
```

**`server/.env`**
| Var | Purpose |
| --- | --- |
| `PORT` | API port (default **5001** — 5000 is taken by macOS AirPlay) |
| `MONGODB_URI` | e.g. `mongodb://127.0.0.1:27017/restaurant_reservation` or an Atlas URI |
| `JWT_SECRET` | Long random string — generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `CLIENT_ORIGIN` | Allowed CORS origin(s), comma-separated (e.g. `http://localhost:5173`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin bootstrapped by the seed script |

> ⚠️ **Never commit `.env`.** Only `.env.example` is tracked. Do not paste real secrets, credentials, or customer data into issues/chats.

### Frontend
```bash
cd client
cp .env.example .env          # set VITE_API_URL to the backend URL
npm install
npm run dev                   # http://localhost:5173
```

**`client/.env`**: `VITE_API_URL=http://localhost:5001/api`

### Seeded logins
| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@restaurant.test` | `Admin@12345` |
| Customer | `customer@restaurant.test` | `Customer@123` |

(Credentials are configurable via the seed env vars; the demo values above are for local dev only — rotate them for any real deployment.)

---

## 2. Assumptions

- **Single restaurant.** No multi-tenant / multi-location modeling.
- **Fixed, enumerable time slots** — 1-hour blocks from `12:00-13:00` through `22:00-23:00` (see `server/src/utils/slots.js`). This turns conflict-checking into a simple equality query instead of interval-overlap math — easier to get correct and to verify. The client slot list mirrors the server's.
- **Tables are seeded** (8 tables, capacities 2–10). Admins can add/edit/disable tables at runtime.
- **Dates stored as `YYYY-MM-DD` strings** to avoid timezone drift in slot comparisons; "past date" is evaluated against the server's local date.
- **Out of scope (per spec):** payments, notifications, waitlists.

---

## 3. Reservation & Availability Logic

**A table is unavailable for a `date + timeSlot` if a `confirmed` reservation already exists for that exact `table + date + timeSlot`.** Cancelled reservations are ignored, so cancelling frees the slot automatically.

**Booking algorithm** (`server/src/controllers/reservationController.js`):
1. Validate input — valid slot, valid non-past date, `guests ≥ 1`.
2. Compute the set of tables already `confirmed` for that `date + timeSlot`.
3. **If a specific `tableId` is requested:** verify it's active, seats the party, and isn't taken — otherwise return a clear `409`/`400`. Never silently substitute a different table.
4. **If no table specified:** auto-assign the **smallest-capacity table that fits** (best-fit — avoids wasting a 10-top on a party of 2).
5. Insert the reservation.

### Double-booking prevention (the hard part)
A **partial unique index** on `{ table, date, timeSlot }` filtered to `status: "confirmed"` (`server/src/models/Reservation.js`) makes **MongoDB itself** reject a second confirmed booking for the same table+slot. The application also re-checks availability before insert, but the index is the authoritative guard — it closes the classic race where two simultaneous requests both pass the availability check.

**Verified:** firing 12 simultaneous identical booking requests results in **exactly one `201` and eleven `409`s** (see `server/` test notes below). Because the filter is `status: "confirmed"`, a cancelled row is excluded and the slot becomes rebookable.

---

## 4. Role-Based Access

Two roles: **customer** (default) and **admin**.

| Capability | Customer | Admin |
| --- | :---: | :---: |
| Register / login | ✅ | ✅ |
| View tables | ✅ | ✅ |
| Check availability | ✅ | ✅ |
| Create own reservation | ✅ | — (managed via admin routes) |
| View **own** reservations | ✅ | ✅ (all) |
| Cancel **own** reservation | ✅ | ✅ (any) |
| View **all** reservations / filter by date | — | ✅ |
| Edit any reservation | — | ✅ |
| Create / edit / disable tables | — | ✅ |

**How it's enforced:**
- JWT payload `{ id, role }`, signed with `JWT_SECRET`, ~1-day expiry.
- `authenticate` middleware verifies the token and re-loads the user (a deleted account can't keep acting on a stale token).
- `authorize(...roles)` middleware gates admin-only routes → `403` otherwise.
- **Registration always sets `role: "customer"`** server-side; the client cannot self-assign admin.
- Ownership checks in the controller: a customer cancelling someone else's reservation gets a `404` (not `403`) so they can't probe for others' reservation IDs.
- The React `<ProtectedRoute>` and role-based nav are **UX only** — every request is independently authorized on the backend. Client-side role checks are never trusted for security.

### API summary (`/api`)
| Method | Route | Access |
| --- | --- | --- |
| POST | `/auth/register` · `/auth/login` | Public |
| GET | `/auth/me` | Authenticated |
| GET | `/tables` | Authenticated |
| POST/PUT/DELETE | `/tables` · `/tables/:id` | Admin |
| GET | `/reservations/availability?date=&timeSlot=&guests=` | Authenticated |
| POST | `/reservations` | Customer |
| GET | `/reservations/my` | Customer |
| PATCH | `/reservations/:id/cancel` | Owner or Admin |
| GET | `/reservations?date=&status=` | Admin |
| PATCH | `/reservations/:id` | Admin |

All errors share one shape: `{ "success": false, "message": "...", "errors": [ … ] }`. Status codes used: `200/201/400/401/403/404/409/500`.

---

## 5. Testing

Backend was verified against a live MongoDB with an end-to-end script covering all
required cases — double-booking → `409`, oversized party → `409`, same table across
different slots → both succeed, cancel-frees-slot, cross-customer isolation (`404`),
non-admin → admin route → `403`, missing/malformed JWT → `401`, admin-cancels-customer
reflected in the customer's list — plus a **concurrency race test** (12 simultaneous
bookings → exactly 1 success). All 23 assertions + the race test passed.

To reproduce locally: start the server, then run a script that hits the API base at
`http://localhost:5001/api` (see §3/§4 for the exact expected status codes).

---

## 6. Deployment

- **Database:** MongoDB Atlas (free tier). Whitelist the backend host / `0.0.0.0/0` for a demo.
- **Backend → Render** (`render.yaml` included) or Railway:
  - Root dir `server`, build `npm install`, start `npm start`.
  - Set env vars in the dashboard (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`=your frontend URL). **Do not** put secrets in the repo.
  - Run the seed once (`npm run seed`) via a one-off job/shell to create the admin.
- **Frontend → Vercel/Netlify** (`vercel.json` / `netlify.toml` included):
  - Root dir `client`, build `npm run build`, output `dist`.
  - Set `VITE_API_URL` to the deployed backend `…/api` URL.
- After deploy, smoke-test the live URL end-to-end as **both** roles.
- **Cold starts:** Render's free tier spins down when idle — the first request after inactivity can take ~30–60s.

---

## 7. Known Limitations

- **Concurrency** is protected by the partial unique index + pre-insert re-check rather than full multi-document transactions. This correctly prevents double-booking (verified) but isn't a general-purpose transactional workflow.
- **No timezone handling** — dates are naive `YYYY-MM-DD`; "past date" uses the server's local clock.
- **No refresh tokens** — a single ~1-day access token; on expiry the user re-logs in.
- **JWT in `localStorage`** on the client for simplicity (susceptible to XSS if the app had an injection vector). A hardened deployment would use httpOnly cookies + CSRF protection.
- **Dev-tooling advisory:** `npm audit` flags the known esbuild/Vite dev-server issue (GHSA-67mh-4wv8-2f99). It affects the local dev server only, not production builds; the fix requires a breaking Vite v8 upgrade, deferred intentionally.
- No payments / notifications / waitlists (out of scope per spec).

---

## 8. Areas for Improvement With More Time

- Full MongoDB **session transactions** around booking.
- **Waitlists** and auto-promotion when a slot frees up.
- **Recurring** reservations and multi-slot bookings.
- Refresh-token rotation + httpOnly cookie storage.
- Rate limiting / account lockout on auth endpoints.
- Automated test suite (Jest/Supertest) in CI.
- Timezone-aware scheduling per restaurant locale.

---

## 9. Live Links

- **Live app:** _add your deployed frontend URL here_
- **API:** _add your deployed backend URL here_
- **Repo:** _add your GitHub repo URL here_
