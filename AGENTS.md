# Project: Commuter-AE — Uber-style ride booking (Cairo, Egypt)

Stack: Next.js 16.2.9 (App Router) + React 19 + Tailwind v4 + TypeScript.
CRITICAL: This Next.js has breaking changes vs. older versions — follow AGENTS.md and
consult the bundled Next docs BEFORE using any Next API (routing, cookies, middleware,
server actions, params). Do not rely on App Router patterns from memory.

## Hard rules (conserve my credits — top priority)

- Work ONLY on the phase I name. Never build ahead or refactor unrelated files.
- REUSE existing files in src/components, src/lib, src/types, src/models. Do not rewrite working code.
- Do not run the dev server or re-read files you've already seen. Minimize tool calls.
- Short confirmations only — no essays, no new markdown docs unless I ask.
- Ask me ONLY when a decision blocks you; otherwise follow the constants below.

## Product flow

"/" landing: Header + Hero (two fields: Pickup location, Dropoff location + "See prices"
submit + "Log in to see your recent activity" link) + How-it-works + Vehicle types & pricing

- CTA + Footer. No visible map on landing.
  On submit: store pickup+dropoff in a Zustand store (persisted to sessionStorage), go to /create.
  "/create": SERVER-side check of the httpOnly auth cookie → if missing/invalid, redirect to
  /login. Layout = form on the LEFT, Google map on the RIGHT (like m.uber.com/go/home).

## /create form — one trip ("cycle")

1. Pickup + Dropoff — autofilled from the Zustand store if present, else empty placeholders.
2. Vehicle type (select) — from VEHICLES.
3. Arrival time (HH:MM, MANDATORY for EVERY vehicle — shared uses the same logic as private,
   only buffer/window differ).
4. Pickup time — TWO READ-ONLY fields, computed via computePickupWindow():
   pickup_to = arrival − duration − buffer
   pickup_from = pickup_to − window
   duration_minutes comes from fetchRoute() in src/lib/openrouteservice.ts after both
   pickup & dropoff are set.
5. Date — pick ONE day from the next 7 days only (today .. today+6).
   A day can hold MANY trips → "Add another trip" appends another cycle for the same date.
   Then "Preview" opens a popup listing every trip → "Submit" → POST /api/trips.

## Constants (already created — import, don't redefine)

- src/lib/config/vehicles.ts → VEHICLES, VEHICLE_LIST, MIN_FARE=20, priceFor()
- src/lib/time/pickupWindow.ts → computePickupWindow(), toMinutes/toHHMM
  Vehicle rates & timing:
  private_car 15 EGP/km private buffer 20 window 10
  taxi_private 12 EGP/km private buffer 20 window 10
  taxi_shared 9 EGP/km shared buffer 30 window 15
  van_shared 7 EGP/km shared buffer 45 window 15
  microbus_shared 5 EGP/km shared buffer 45 window 15
  Price per trip = max(MIN_FARE, round(distance_km \* rate)).
  Times "HH:MM" 24h internally, render 12h. Dates "YYYY-MM-DD".

## State

src/lib/store/useTripStore.ts — Zustand: { pickup, dropoff } persisted to sessionStorage.

## Auth (httpOnly cookie + JWT)

Sign/verify a JWT with `jose`; store it in an httpOnly, Secure, SameSite=Lax cookie.
Passwords hashed with bcryptjs. APIs: /api/auth/register, /api/auth/login, /api/auth/logout.
Helper src/lib/auth/session.ts → getSession() usable in server components. Protect
/create, /profile, /my-trips on the server (redirect to /login when no valid session).

## Database (Mongoose — models already defined)

src/lib/db/mongoose.ts — cached connection (reuse across hot reloads).
src/models/User.ts, src/models/Booking.ts (Booking = one date with a trips[] array).
SECURITY: in POST /api/trips, recompute rideType, pickupFrom/To and priceEgp on the server
from distanceKm + vehicleType + arrivalTime. Never trust client-sent prices/times.

## Map / autocomplete (DECIDED: Google Maps)

Use committed src/lib/googleMapsStyle.ts (MAP_STYLE) and src/lib/nominatim.ts.
nominatim.ts + openrouteservice.ts require these server proxy routes — read the server-only
GOOGLE_MAPS_API_KEY (never expose it):
/api/places/autocomplete?q= → [{ place_id, display_name }]
/api/places/details?id= → { lat, lng }
/api/geocode/reverse?lat=&lng= → { address }
/api/directions?origin=&dest=&waypoints=
Map render uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY via @react-google-maps/api + MAP_STYLE.

## Landing "/" structure

Header (logo + nav + Login) → Hero (headline + two-field form + "See prices" +
"Log in to see your recent activity") → How-it-works (3–4 steps) → Vehicle types & pricing
(cards from VEHICLE_LIST) → CTA band → Footer.
Animate with `motion`: hero fade/slide-in on mount; sections reveal on scroll
(whileInView, viewport once:true); keep ≤300ms, subtle; respect prefers-reduced-motion.
Brand tokens only (primary #0B1E3D, secondary #00C2A8, accent #F5A623; see globals.css + MAP_COLORS.md).

## Pages

/login — email + password; on success set cookie, redirect to /create (or stored intent).
/profile — server: getSession(); show name/email/phone + minimal edit (PATCH /api/auth/me).
/my-trips — server: fetch this user's Bookings newest-first, grouped by date; show vehicle,
pickup→dropoff, pickup window, price, status pill. Reuse StatusPill + EmptyState
from src/components/shared.
All three redirect to /login when there's no session.

## Dependencies (ALREADY installed — do NOT reinstall)

zustand mongoose jose bcryptjs @react-google-maps/api motion lucide-react date-fns
(+ dev @types/bcryptjs @types/google.maps).
i18n is DEFERRED: if you reuse a component importing next-intl, replace it with plain
English strings — do NOT add next-intl.

## Env (.env.local — already present)

MONGODB_URI, JWT_SECRET, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_ORS_API_KEY.
Add GOOGLE_MAPS_API_KEY (server-only) for the proxy routes.

## Build phases (one at a time; I'll say which)

0 Setup: mongoose.ts, db connection, the places/geocode/directions API routes (vehicles.ts,
pickupWindow.ts, User.ts, Booking.ts already exist — verify only).
1 Landing: Header, Hero+form (Zustand), How-it-works, Vehicle/pricing, CTA, Footer + motion.
2 Auth: register/login/logout APIs, session.ts, /login, protect /create.
3 Create form: multi-trip form + computed pickup window + 7-day date picker.
4 Map: right-panel Google map + route, reusing existing components.
5 Preview + Submit: preview popup → POST /api/trips (server recomputes price/times).
6 Profile + My-trips pages.

## START

Phase 0 only: create src/lib/db/mongoose.ts (cached connection) and the four server proxy
routes (/api/places/autocomplete, /api/places/details, /api/geocode/reverse, /api/directions).
Verify vehicles.ts, pickupWindow.ts, User.ts, Booking.ts compile. Then STOP and wait.
