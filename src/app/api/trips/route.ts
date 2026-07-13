import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import {
  VEHICLES,
  priceFor,
  maxExtraPassengers,
  finalPrice,
  waitingCostEgp,
} from "@/lib/config/vehicles";
import {
  computeArrivalTime,
  computePickupTime,
} from "@/lib/time/pickupWindow";
import { isDateInWindow } from "@/lib/time/bookingDates";
import { getVehicles } from "@/lib/db/getVehicles";
import { fetchDirections } from "@/app/api/directions/route";
import { Types } from "mongoose";

interface PassengerInput {
  sameAsMain: boolean;
  pickup?: { address: string; lat: number; lng: number } | null;
  dropoff?: { address: string; lat: number; lng: number } | null;
}

interface StopInput {
  point: { address: string; lat: number; lng: number };
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}

interface TripInput {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  vehicleType: string;
  arrivalTime?: string;
  pickupTime?: string;
  distanceKm: number;
  durationMinutes: number;
  extraPassengers?: number;
  passengers?: PassengerInput[];
  numberOfPassengers?: number;
  stops?: StopInput[];
  pickupStation?: { lat: number; lng: number; name: string };
  dropoffStation?: { lat: number; lng: number; name: string };
  walkingMinToStation?: number;
  walkingMinFromStation?: number;
}

/** Fetch total distance/duration for an origin→...waypoints...→dest route directly from Google (no internal HTTP hop). */
async function fetchServerRoute(
  points: { lat: number; lng: number }[],
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const origin = `${points[0].lat},${points[0].lng}`;
  const dest = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const mid = points.slice(1, -1);
  const waypoints = mid.length
    ? mid.map((p) => `${p.lat},${p.lng}`).join("|")
    : undefined;
  const data = await fetchDirections(origin, dest, waypoints);
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

  let body: { date?: string; dates?: string[]; trips: TripInput[] };
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
  for (const d of dates) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !isDateInWindow(d)) {
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
    numberOfPassengers: number;
    stops: StopInput[];
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
    const vKey = t.vehicleType as keyof typeof VEHICLES;
    const vehicle = vehiclesMap[vKey];
    const isShared = vehicle.ride === "shared";

    if (!isShared) {
      if (
        !t.pickupTime ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.pickupTime)
      ) {
        return NextResponse.json(
          { error: "Invalid pickupTime" },
          { status: 400 },
        );
      }

      const numberOfPassengers = Number(t.numberOfPassengers);
      if (
        !Number.isInteger(numberOfPassengers) ||
        numberOfPassengers < 1 ||
        numberOfPassengers > vehicle.occupancy
      ) {
        return NextResponse.json(
          { error: "Invalid numberOfPassengers" },
          { status: 400 },
        );
      }

      if (!Array.isArray(t.stops) || t.stops.length > 4) {
        return NextResponse.json({ error: "Invalid stops" }, { status: 400 });
      }

      const stops: StopInput[] = [];
      let onboard = numberOfPassengers;
      for (const stop of t.stops) {
        if (
          !stop.point?.address ||
          !Number.isFinite(stop.point.lat) ||
          !Number.isFinite(stop.point.lng) ||
          !Number.isInteger(stop.alighting) ||
          !Number.isInteger(stop.boarding) ||
          !Number.isInteger(stop.waitingMinutes) ||
          stop.alighting < 0 ||
          stop.boarding < 0 ||
          stop.waitingMinutes < 0
        ) {
          return NextResponse.json(
            { error: "Invalid stop" },
            { status: 400 },
          );
        }
        if (stop.alighting > onboard - 1) {
          return NextResponse.json(
            { error: "At least one passenger must remain onboard" },
            { status: 400 },
          );
        }
        const afterAlighting = onboard - stop.alighting;
        if (stop.boarding > vehicle.occupancy - afterAlighting) {
          return NextResponse.json(
            { error: "Vehicle occupancy exceeded" },
            { status: 400 },
          );
        }
        onboard = afterAlighting + stop.boarding;
        stops.push({
          point: {
            address: stop.point.address,
            lat: stop.point.lat,
            lng: stop.point.lng,
          },
          alighting: stop.alighting,
          boarding: stop.boarding,
          waitingMinutes: stop.waitingMinutes,
        });
      }

      const distinctPassengers = (t.passengers ?? []).filter(
        (passenger) =>
          !passenger.sameAsMain && passenger.pickup && passenger.dropoff,
      );
      if (stops.length > 0 && distinctPassengers.length > 0) {
        return NextResponse.json(
          { error: "Stop points cannot be combined with passenger detours" },
          { status: 400 },
        );
      }
      const serverPassengers = (t.passengers ?? []).map((passenger) =>
        passenger.sameAsMain || !passenger.pickup || !passenger.dropoff
          ? { sameAsMain: true, pickup: null, dropoff: null }
          : {
              sameAsMain: false,
              pickup: passenger.pickup,
              dropoff: passenger.dropoff,
            },
      );

      let route = await fetchServerRoute([
        t.pickup,
        ...stops.map((stop) => stop.point),
        t.dropoff,
      ]);
      if (distinctPassengers.length > 0) {
        const baseRoute = await fetchServerRoute([t.pickup, t.dropoff]);
        const detourRoute = await fetchServerRoute([
          t.pickup,
          ...distinctPassengers.map((passenger) => passenger.pickup!),
          ...distinctPassengers.map((passenger) => passenger.dropoff!),
          t.dropoff,
        ]);
        if (!baseRoute || !detourRoute) {
          return NextResponse.json(
            { error: "Failed to compute passenger detour route." },
            { status: 502 },
          );
        }
        if (detourRoute.distanceKm > baseRoute.distanceKm * 1.25) {
          return NextResponse.json(
            { error: "Detour exceeds 25%" },
            { status: 400 },
          );
        }
        route = detourRoute;
      }
      if (!route) {
        return NextResponse.json(
          { error: "Failed to compute route" },
          { status: 502 },
        );
      }

      const totalWaitingMinutes = stops.reduce(
        (total, stop) => total + stop.waitingMinutes,
        0,
      );
      const arrivalTime = computeArrivalTime(
        t.pickupTime,
        route.durationMinutes,
        totalWaitingMinutes,
        10,
      );
      const basePrice = priceFor(route.distanceKm, vKey, vehiclesMap);
      const priceEgp =
        finalPrice(basePrice, numberOfPassengers - 1, vKey) +
        waitingCostEgp(totalWaitingMinutes, vKey, vehiclesMap);

      serverTrips.push({
        pickup: t.pickup,
        dropoff: t.dropoff,
        vehicleType: vKey,
        rideType: vehicle.ride,
        arrivalTime,
        pickupTime: t.pickupTime,
        distanceKm: route.distanceKm,
        durationMinutes: Math.round(route.durationMinutes),
        priceEgp,
        extraPassengers: 0,
        numberOfPassengers,
        stops,
        passengers: serverPassengers,
      });
      continue;
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
      const base = await fetchServerRoute([t.pickup, t.dropoff]);
      const waypoints = [
        t.pickup,
        ...distinctPassengers.map((p) => p.pickup!),
        ...distinctPassengers.map((p) => p.dropoff!),
        t.dropoff,
      ];
      const combined = await fetchServerRoute(waypoints);
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
      numberOfPassengers: 1,
      stops: [],
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

  const perDateAmountEgp = serverTrips.reduce((sum, t) => sum + t.priceEgp, 0);
  const amountEgp = perDateAmountEgp * dates.length;

  await connectDB();

  const request = await Request.create({
    userId: new Types.ObjectId(session.userId),
    dates,
    amountEgp,
    paymentStatus: "pending",
    status: "pending_payment",
  });

  try {
    const tripDocuments = dates.flatMap((date) =>
      serverTrips.map((trip, cycleIndex) => ({
        requestId: request._id,
        userId: new Types.ObjectId(session.userId),
        date,
        cycleIndex,
        ...trip,
        paymentStatus: "pending",
        status: "pending_payment",
      })),
    );
    await Trip.insertMany(tripDocuments);
  } catch (err) {
    await Request.deleteOne({ _id: request._id });
    console.error("Trip fan-out failed — request rolled back:", err);
    return NextResponse.json(
      { error: "Failed to create trips" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { bookingId: String(request._id), amountEgp },
    { status: 201 },
  );
}
