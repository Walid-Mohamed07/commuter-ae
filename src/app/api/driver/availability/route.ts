import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { getSession } from "@/lib/auth/session";

interface Point {
  address: string;
  lat: number;
  lng: number;
}

function isValidPoint(p: unknown): p is Point {
  const point = p as Point;
  return (
    !!point &&
    typeof point.address === "string" &&
    point.address.trim().length > 0 &&
    typeof point.lat === "number" &&
    typeof point.lng === "number"
  );
}

function isValidTime(t: unknown): t is string {
  return typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const records = await Availability.find({ driverId: session.userId })
    .sort({ date: 1 })
    .lean();
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const driver = await Driver.findOne({ userId: session.userId })
    .select("verificationStatus")
    .lean<{ verificationStatus?: string }>();
  if (driver?.verificationStatus !== "verified")
    return NextResponse.json(
      { error: "Your profile must be verified before adding availability." },
      { status: 403 },
    );

  try {
    const { dates, startLocation, endLocation, startTime, endTime } =
      await req.json();

    if (!Array.isArray(dates) || dates.length === 0)
      return NextResponse.json(
        { error: "Select at least one date." },
        { status: 400 },
      );
    if (
      !dates.every(
        (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
      )
    )
      return NextResponse.json(
        { error: "Invalid date format." },
        { status: 400 },
      );
    if (!isValidPoint(startLocation) || !isValidPoint(endLocation))
      return NextResponse.json(
        { error: "Start and end locations are required." },
        { status: 400 },
      );
    if (!isValidTime(startTime) || !isValidTime(endTime))
      return NextResponse.json(
        { error: "Start and end time are required." },
        { status: 400 },
      );
    if (startTime >= endTime)
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );

    const docs = dates.map((date: string) => ({
      driverId: session.userId,
      date,
      startLocation: {
        address: startLocation.address,
        lat: startLocation.lat,
        lng: startLocation.lng,
      },
      endLocation: {
        address: endLocation.address,
        lat: endLocation.lat,
        lng: endLocation.lng,
      },
      startTime,
      endTime,
    }));

    const created = await Availability.insertMany(docs);
    return NextResponse.json({ ok: true, records: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create availability." },
      { status: 500 },
    );
  }
}
