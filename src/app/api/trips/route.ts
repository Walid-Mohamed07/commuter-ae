import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/models/Booking";
import {
  VEHICLES,
  priceFor,
  maxExtraPassengers,
  finalPrice,
} from "@/lib/config/vehicles";
import { computePickupTime } from "@/lib/time/pickupWindow";
import { isDateInWindow, isValidStartDate } from "@/lib/time/bookingDates";
import { getVehicles } from "@/lib/db/getVehicles";
import { Types } from "mongoose";
import { randomUUID } from "crypto";

interface PassengerInput {
  sameAsMain: boolean;
  pickup?: { address: string; lat: number; lng: number } | null;
  dropoff?: { address: string; lat: number; lng: number } | null;
}

interface TripInput {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  vehicleType: string;
  arrivalTime: string;
  distanceKm: number;
  durationMinutes: number;
  extraPassengers?: number;
  passengers?: PassengerInput[];
  pickupStation?: { lat: number; lng: number; name: string };
  dropoffStation?: { lat: number; lng: number; name: string };
  walkingMinToStation?: number;
  walkingMinFromStation?: number;
}

/** Fetch total distance/duration for an origin→...waypoints...→dest route via the directions proxy. */
async function fetchServerRoute(
  appUrl: string,
  points: { lat: number; lng: number }[],
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const origin = `${points[0].lat},${points[0].lng}`;
  const dest = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const mid = points.slice(1, -1);
  const url = new URL(`${appUrl}/api/directions`);
  url.searchParams.set("origin", origin);
  url.searchParams.set("dest", dest);
  if (mid.length) {
    url.searchParams.set(
      "waypoints",
      mid.map((p) => `${p.lat},${p.lng}`).join("|"),
    );
  }
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    distance_km: number;
    duration_minutes: number;
  }>;
  if (!data.length) return null;
  return {
    distanceKm: data[0].distance_km,
    durationMinutes: data[0].duration_minutes,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date?: string; dates?: string[]; startDate?: string; trips: TripInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trips } = body;
  const rawDates = body.dates ?? (body.date ? [body.date] : []);

  // Basic input validation
  if (!Array.isArray(rawDates) || rawDates.length === 0) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const dates = Array.from(new Set(rawDates)).slice(0, 7);
  const startDate = body.startDate ?? dates[0];
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !isValidStartDate(startDate)) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  for (const d of dates) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !isDateInWindow(d, startDate)) {
      return NextResponse.json(
        { error: `Invalid or out-of-window date: ${d}` },
        { status: 400 },
      );
    }
  }
  if (!Array.isArray(trips) || trips.length === 0 || trips.length > 10) {
    return NextResponse.json({ error: "Invalid trips" }, { status: 400 });
  }

  const vehiclesMap = await getVehicles();
  const allowedVehicles = Object.keys(vehiclesMap);

  interface ServerTrip {
    pickup: { address: string; lat: number; lng: number };
    dropoff: { address: string; lat: number; lng: number };
    vehicleType: string;
    rideType: string;
    arrivalTime: string;
    pickupTime: string;
    distanceKm: number;
    durationMinutes: number;
    priceEgp: number;
    extraPassengers: number;
    passengers: {
      sameAsMain: boolean;
      pickup: { address: string; lat: number; lng: number } | null;
      dropoff: { address: string; lat: number; lng: number } | null;
    }[];
    pickupStation?: { lat: number; lng: number; name: string };
    dropoffStation?: { lat: number; lng: number; name: string } | null;
    walkingMinToStation?: number;
    walkingMinFromStation?: number;
  }

  const serverTrips: ServerTrip[] = [];
  for (const t of trips) {
    // Validate required fields
    if (!t.pickup?.address || !t.dropoff?.address) {
      return NextResponse.json(
        { error: "Missing pickup/dropoff" },
        { status: 400 },
      );
    }
    if (!allowedVehicles.includes(t.vehicleType)) {
      return NextResponse.json(
        { error: "Invalid vehicleType" },
        { status: 400 },
      );
    }
    if (!t.arrivalTime || !/^\d{2}:\d{2}$/.test(t.arrivalTime)) {
      return NextResponse.json(
        { error: "Invalid arrivalTime" },
        { status: 400 },
      );
    }
    const distKm = Number(t.distanceKm);
    const durMin = Number(t.durationMinutes);
    if (!isFinite(distKm) || distKm <= 0 || !isFinite(durMin) || durMin <= 0) {
      return NextResponse.json(
        { error: "Invalid route data" },
        { status: 400 },
      );
    }

    const vKey = t.vehicleType as keyof typeof VEHICLES;
    const vehicle = vehiclesMap[vKey];
    const SHARED_TYPES = new Set([
      "taxi_shared",
      "van_shared",
      "microbus_shared",
    ]);
    const isShared = SHARED_TYPES.has(vKey);

    // Passenger detour (private vehicles only) — server-recompute combined distance
    let effectiveDistKm = distKm;
    let effectiveDurMin = durMin;
    const distinctPassengers = isShared
      ? []
      : (t.passengers ?? []).filter(
          (p) => !p.sameAsMain && p.pickup && p.dropoff,
        );
    const serverPassengers = isShared
      ? []
      : (t.passengers ?? []).map((p) =>
          p.sameAsMain || !p.pickup || !p.dropoff
            ? { sameAsMain: true, pickup: null, dropoff: null }
            : { sameAsMain: false, pickup: p.pickup, dropoff: p.dropoff },
        );

    if (distinctPassengers.length > 0) {
      const appUrl = process.env.APP_URL;
      if (!appUrl) {
        return NextResponse.json(
          { error: "APP_URL is not configured on the server." },
          { status: 500 },
        );
      }
      const base = await fetchServerRoute(appUrl, [t.pickup, t.dropoff]);
      const waypoints = [
        t.pickup,
        ...distinctPassengers.map((p) => p.pickup!),
        ...distinctPassengers.map((p) => p.dropoff!),
        t.dropoff,
      ];
      const combined = await fetchServerRoute(appUrl, waypoints);
      if (!base || !combined) {
        return NextResponse.json(
          { error: "Failed to compute passenger detour route." },
          { status: 502 },
        );
      }
      if (combined.distanceKm > base.distanceKm * 1.25) {
        return NextResponse.json(
          { error: "Detour exceeds 25%" },
          { status: 400 },
        );
      }
      effectiveDistKm = combined.distanceKm;
      effectiveDurMin = combined.durationMinutes;
    }

    // Server-side recompute — never trust client values
    const rideType = vehicle.ride;
    // For shared: add walk-from-station time so pickup_time accounts for it
    const extraWalk =
      isShared && typeof t.walkingMinFromStation === "number"
        ? Math.max(0, Math.round(t.walkingMinFromStation))
        : 0;
    const pickupTime = computePickupTime(
      t.arrivalTime,
      Math.round(effectiveDurMin) + extraWalk,
      vKey,
      vehiclesMap,
    );
    const basePrice = priceFor(effectiveDistKm, vKey, vehiclesMap);
    const extraPax = Math.min(
      maxExtraPassengers(vKey),
      Math.max(0, Math.round(Number(t.extraPassengers ?? 0))),
    );
    const priceEgp = finalPrice(basePrice, extraPax, vKey);

    serverTrips.push({
      pickup: {
        address: t.pickup.address,
        lat: t.pickup.lat,
        lng: t.pickup.lng,
      },
      dropoff: {
        address: t.dropoff.address,
        lat: t.dropoff.lat,
        lng: t.dropoff.lng,
      },
      vehicleType: vKey,
      rideType,
      arrivalTime: t.arrivalTime,
      pickupTime,
      distanceKm: effectiveDistKm,
      durationMinutes: Math.round(effectiveDurMin),
      priceEgp,
      extraPassengers: extraPax,
      passengers: serverPassengers,
      ...(isShared && t.pickupStation
        ? {
            pickupStation: t.pickupStation,
            dropoffStation: t.dropoffStation ?? null,
            walkingMinToStation: Math.max(
              0,
              Math.round(t.walkingMinToStation ?? 0),
            ),
            walkingMinFromStation: Math.max(
              0,
              Math.round(t.walkingMinFromStation ?? 0),
            ),
          }
        : {}),
    });
  }

  const amountEgp = serverTrips.reduce((sum, t) => sum + t.priceEgp, 0);

  await connectDB();

  const groupId = randomUUID();
  const bookings = await Booking.insertMany(
    dates.map((d) => ({
      userId: new Types.ObjectId(session.userId),
      date: d,
      groupId,
      trips: serverTrips,
      amountEgp,
      paymentStatus: "pending",
      status: "pending_payment",
    })),
  );

  return NextResponse.json(
    {
      groupId,
      bookingIds: bookings.map((b) => String(b._id)),
      amountEgp: amountEgp * dates.length,
    },
    { status: 201 },
  );
}
