# Trimly Frontend

This lightweight frontend is served by the FastAPI backend and is available at:

- `GET /app`

Static assets are under:

- `frontend/index.html`
- `frontend/styles.css`
- `frontend/app.js`

## What it covers

- Register (`POST /register`)
- Login (`POST /login` form-encoded)
- Current user (`GET /me`)
- Admin check (`GET /admin-only`)
- Create barber profile (`POST /barber/profile`)
- Create booking (`POST /bookings`)
- Update booking status (`PATCH /bookings/{booking_id}/status`)
- Initialize payment (`POST /bookings/{booking_id}/initialize-payment`)
- Verify payment (`GET /payment/verify/{reference}`)
- Barber availability (`GET /barber/{barber_id}/availability`)
- List bookings (`GET /bookings`)

The page stores API base URL and bearer token in `localStorage`.
