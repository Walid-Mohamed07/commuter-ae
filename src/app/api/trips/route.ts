import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/models/Booking";
import { VEHICLES, priceFor } from "@/lib/config/vehicles";
import { computePickupTime } from "@/lib/time/pickupWindow";
import { Types } from "mongoose";

interface TripInput {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  vehicleType: string;
  arrivalTime: string;
  distanceKm: number;
  durationMinutes: number;
  extraPassengers?: number;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date: string; trips: TripInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, trips } = body;

  // Basic input validation
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!Array.isArray(trips) || trips.length === 0 || trips.length > 10) {
    return NextResponse.json({ error: "Invalid trips" }, { status: 400 });
  }

  const allowedVehicles = Object.keys(VEHICLES);

  const serverTrips = [];
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
    const vehicle = VEHICLES[vKey];

    // Server-side recompute — never trust client values
    const rideType = vehicle.ride;
    const pickupTime = computePickupTime(
      t.arrivalTime,
      Math.round(durMin),
      vKey,
    );
    const priceEgp = priceFor(distKm, vKey);

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
      distanceKm: distKm,
      durationMinutes: Math.round(durMin),
      priceEgp,
      extraPassengers: Math.min(
        3,
        Math.max(0, Math.round(Number(t.extraPassengers ?? 0))),
      ),
    });
  }

  const amountEgp = serverTrips.reduce((sum, t) => sum + t.priceEgp, 0);

  await connectDB();

  const booking = await Booking.create({
    userId: new Types.ObjectId(session.userId),
    date,
    trips: serverTrips,
    amountEgp,
    paymentStatus: "pending",
    status: "pending_payment",
  });

  return NextResponse.json({ bookingId: String(booking._id) }, { status: 201 });
}
