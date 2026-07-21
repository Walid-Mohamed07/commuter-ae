import { NextRequest, NextResponse } from "next/server";
import { createRide, getRidesByDriver } from "@/lib/services/rideService";

// POST /api/rides — create a ride from a match result
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ride = await createRide(body);
    return NextResponse.json({ data: ride }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create ride" },
      { status: 400 },
    );
  }
}

// GET /api/rides?driverId=...&date=YYYY-MM-DD — list rides for a driver
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get("driverId");
    const date = searchParams.get("date") ?? undefined;

    if (!driverId) {
      return NextResponse.json(
        { error: "driverId is required" },
        { status: 400 },
      );
    }

    const rides = await getRidesByDriver(driverId, date);
    return NextResponse.json({ data: rides });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch rides" },
      { status: 500 },
    );
  }
}
