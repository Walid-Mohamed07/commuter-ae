import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TODO: restrict to admin once dashboard exists
// GET /api/admin/getPrivateRideRequests?format=json|xlsx

interface StopLike {
  point?: { lat: number; lng: number };
  alighting?: number;
  boarding?: number;
  waitingMinutes?: number;
}

interface Row {
  rideId: number;
  passId: number | null;
  originNearestStationNo: number | null;
  originLat: number | null;
  originLong: number | null;
  destinationNearestStationNo: number | null;
  destinationLat: number | null;
  destinationLong: number | null;
  stop1Lat: number | null;
  stop1Long: number | null;
  stop1Alighting: number | null;
  stop1Boarding: number | null;
  stop1WaitingTime: number | null;
  stop2Lat: number | null;
  stop2Long: number | null;
  stop2Alighting: number | null;
  stop2Boarding: number | null;
  stop2WaitingTime: number | null;
  stop3Lat: number | null;
  stop3Long: number | null;
  stop3Alighting: number | null;
  stop3Boarding: number | null;
  stop3WaitingTime: number | null;
  stop4Lat: number | null;
  stop4Long: number | null;
  stop4Alighting: number | null;
  stop4Boarding: number | null;
  stop4WaitingTime: number | null;
  readyFrom: string;
  shouldArrivebefore: string;
  rideType: number;
  totalStartedPassengers: number;
}

const COLUMNS: (keyof Row)[] = [
  "rideId",
  "passId",
  "originNearestStationNo",
  "originLat",
  "originLong",
  "destinationNearestStationNo",
  "destinationLat",
  "destinationLong",
  "stop1Lat",
  "stop1Long",
  "stop1Alighting",
  "stop1Boarding",
  "stop1WaitingTime",
  "stop2Lat",
  "stop2Long",
  "stop2Alighting",
  "stop2Boarding",
  "stop2WaitingTime",
  "stop3Lat",
  "stop3Long",
  "stop3Alighting",
  "stop3Boarding",
  "stop3WaitingTime",
  "stop4Lat",
  "stop4Long",
  "stop4Alighting",
  "stop4Boarding",
  "stop4WaitingTime",
  "readyFrom",
  "shouldArrivebefore",
  "rideType",
  "totalStartedPassengers",
];

export async function GET(req: NextRequest) {
  const format =
    req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "json";

  await connectDB();

  const trips = await Trip.find({
    status: "submitted",
    paymentStatus: "paid",
    vehicleType: { $in: ["private_car", "taxi_private"] },
  }).lean<
    {
      tripNumber: number;
      userId: unknown;
      pickup?: { lat: number; lng: number };
      dropoff?: { lat: number; lng: number };
      pickupStation?: { id: number };
      dropoffStation?: { id: number };
      stops?: StopLike[];
      pickupTime: string;
      arrivalTime: string;
      vehicleType: string;
      numberOfPassengers: number;
    }[]
  >();

  const userIds = Array.from(new Set(trips.map((t) => String(t.userId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select("userNumber")
    .lean<{ _id: unknown; userNumber: number }[]>();
  const userNumberMap = new Map(
    users.map((u) => [String(u._id), u.userNumber]),
  );

  const rows: Row[] = trips.map((trip) => {
    const s = trip.stops ?? [];
    return {
      rideId: trip.tripNumber,
      passId: userNumberMap.get(String(trip.userId)) ?? null,
      originNearestStationNo: trip.pickupStation?.id ?? null,
      originLat: trip.pickup?.lat ?? null,
      originLong: trip.pickup?.lng ?? null,
      destinationNearestStationNo: trip.dropoffStation?.id ?? null,
      destinationLat: trip.dropoff?.lat ?? null,
      destinationLong: trip.dropoff?.lng ?? null,
      stop1Lat: s[0]?.point?.lat ?? null,
      stop1Long: s[0]?.point?.lng ?? null,
      stop1Alighting: s[0]?.alighting ?? null,
      stop1Boarding: s[0]?.boarding ?? null,
      stop1WaitingTime: s[0]?.waitingMinutes ?? null,
      stop2Lat: s[1]?.point?.lat ?? null,
      stop2Long: s[1]?.point?.lng ?? null,
      stop2Alighting: s[1]?.alighting ?? null,
      stop2Boarding: s[1]?.boarding ?? null,
      stop2WaitingTime: s[1]?.waitingMinutes ?? null,
      stop3Lat: s[2]?.point?.lat ?? null,
      stop3Long: s[2]?.point?.lng ?? null,
      stop3Alighting: s[2]?.alighting ?? null,
      stop3Boarding: s[2]?.boarding ?? null,
      stop3WaitingTime: s[2]?.waitingMinutes ?? null,
      stop4Lat: s[3]?.point?.lat ?? null,
      stop4Long: s[3]?.point?.lng ?? null,
      stop4Alighting: s[3]?.alighting ?? null,
      stop4Boarding: s[3]?.boarding ?? null,
      stop4WaitingTime: s[3]?.waitingMinutes ?? null,
      readyFrom: trip.pickupTime,
      shouldArrivebefore: trip.arrivalTime,
      rideType: trip.vehicleType === "private_car" ? 1 : 2,
      totalStartedPassengers: trip.numberOfPassengers,
    };
  });

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("PrivateRideRequests");
    ws.addRow(COLUMNS);
    for (const r of rows) ws.addRow(COLUMNS.map((c) => r[c]));
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="private-ride-requests.xlsx"',
      },
    });
  }

  return new NextResponse(JSON.stringify(rows, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition":
        'attachment; filename="private-ride-requests.json"',
    },
  });
}
