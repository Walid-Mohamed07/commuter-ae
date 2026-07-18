import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import type { PaymentStatus, TripListRow } from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";

export interface ListUserTripsOptions {
  page: number;
  pageSize?: number;
  paymentStatus?: PaymentStatus;
  vehicleType?: string;
}

export async function listUserTrips(
  userId: string,
  { page, pageSize = 12, paymentStatus, vehicleType }: ListUserTripsOptions,
): Promise<{ rows: TripListRow[]; total: number; page: number }> {
  await connectDB();

  const tripMatch: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
  };
  if (paymentStatus) tripMatch.paymentStatus = paymentStatus;
  if (vehicleType) tripMatch.vehicleType = vehicleType;

  const [total, rawTrips] = await Promise.all([
    Trip.countDocuments(tripMatch),
    Trip.find(tripMatch)
      .sort({ date: -1, cycleIndex: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<
        {
          _id: unknown;
          date: string;
          paymentStatus: string;
          vehicleType: string;
          pickup: GeoPoint;
          dropoff: GeoPoint;
          pickupTime: string;
          arrivalTime: string;
          priceEgp: number;
          createdAt: Date | string;
        }[]
      >(),
  ]);

  return {
    total,
    page,
    rows: rawTrips.map((trip) => ({
      id: String(trip._id),
      date: trip.date,
      paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
      vehicleType: trip.vehicleType,
      pickupAddress: trip.pickup?.address ?? "—",
      dropoffAddress: trip.dropoff?.address ?? "—",
      pickup:
        typeof trip.pickup?.lat === "number"
          ? { lat: trip.pickup.lat, lng: trip.pickup.lng }
          : null,
      dropoff:
        typeof trip.dropoff?.lat === "number"
          ? { lat: trip.dropoff.lat, lng: trip.dropoff.lng }
          : null,
      pickupTime: trip.pickupTime,
      arrivalTime: trip.arrivalTime,
      priceEgp: trip.priceEgp,
      createdAt:
        trip.createdAt instanceof Date
          ? trip.createdAt.toISOString()
          : String(trip.createdAt),
    })),
  };
}

export interface UserTripDetail {
  id: string;
  requestId: string;
  date: string;
  cycleIndex: number;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  vehicleType: string;
  rideType: string;
  arrivalTime: string;
  pickupTime: string;
  distanceKm: number;
  durationMinutes: number;
  priceEgp: number;
  extraPassengers: number;
  pickupStation?: StationSelection;
  dropoffStation?: StationSelection;
  walkingMinToStation?: number;
  walkingMinFromStation?: number;
  passengers: {
    sameAsMain: boolean;
    pickup?: GeoPoint | null;
    dropoff?: GeoPoint | null;
  }[];
  paymentStatus: PaymentStatus;
  status: string;
  createdAt: string;
}

export async function getUserTrip(
  userId: string,
  tripId: string,
): Promise<UserTripDetail | null> {
  if (!Types.ObjectId.isValid(tripId)) return null;

  await connectDB();
  const trip = await Trip.findOne({
    _id: tripId,
    userId: new Types.ObjectId(userId),
  }).lean<{
    _id: unknown;
    requestId: unknown;
    date: string;
    cycleIndex: number;
    pickup: GeoPoint;
    dropoff: GeoPoint;
    vehicleType: string;
    rideType: string;
    arrivalTime: string;
    pickupTime: string;
    distanceKm: number;
    durationMinutes: number;
    priceEgp: number;
    extraPassengers: number;
    pickupStation?: StationSelection;
    dropoffStation?: StationSelection;
    walkingMinToStation?: number;
    walkingMinFromStation?: number;
    passengers: {
      sameAsMain: boolean;
      pickup?: GeoPoint | null;
      dropoff?: GeoPoint | null;
    }[];
    paymentStatus: string;
    status: string;
    createdAt: Date | string;
  }>();

  if (!trip) return null;

  return {
    ...trip,
    id: String(trip._id),
    requestId: String(trip.requestId),
    paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
    createdAt:
      trip.createdAt instanceof Date
        ? trip.createdAt.toISOString()
        : String(trip.createdAt),
  };
}
