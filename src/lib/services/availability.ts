import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import type { GeoPoint } from "@/types/geo";

export interface AvailabilityRecord {
  _id: string;
  date: string;
  startLocation: GeoPoint;
  endLocation: GeoPoint;
  startTime: string;
  endTime: string;
}

export async function listDriverAvailability(
  driverId: string,
): Promise<AvailabilityRecord[]> {
  await connectDB();
  const records = await Availability.find({ driverId }).sort({ date: 1 }).lean<
    {
      _id: unknown;
      date: string;
      startLocation: GeoPoint;
      endLocation: GeoPoint;
      startTime: string;
      endTime: string;
    }[]
  >();

  return records.map((record) => ({
    _id: String(record._id),
    date: record.date,
    startLocation: record.startLocation,
    endLocation: record.endLocation,
    startTime: record.startTime,
    endTime: record.endTime,
  }));
}
