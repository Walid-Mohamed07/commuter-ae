import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Request as RequestModel } from "@/models/Request";
import type {
  BookingStatus,
  PaymentStatus,
  TripListRow,
} from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";

export interface StationOption extends StationSelection {
  distanceKm: number;
  walkingMin: number;
}

const STATUS_GROUPS: Record<string, BookingStatus[]> = {
  pending_payment: ["pending_payment"],
  upcoming: ["submitted", "confirmed"],
  ongoing: ["active", "matching"],
  previous: ["completed", "cancelled", "time_out"],
};

export interface ListUserTripsOptions {
  page: number;
  pageSize?: number;
  paymentStatus?: PaymentStatus;
  vehicleType?: string;
  statusGroup?: "previous" | "ongoing" | "upcoming" | "pending_payment";
  dateFrom?: string;
  dateTo?: string;
}

export async function listDriverTrips(
  driverId: string,
  options: ListUserTripsOptions,
): Promise<{ rows: TripListRow[]; total: number; page: number }> {
  await connectDB();

  const {
    page,
    pageSize = 12,
    paymentStatus,
    vehicleType,
    statusGroup,
    dateFrom,
    dateTo,
  } = options;

  const tripMatch: Record<string, unknown> = {
    driverId: new Types.ObjectId(driverId),
  };
  if (paymentStatus) tripMatch.paymentStatus = paymentStatus;
  if (vehicleType) tripMatch.vehicleType = vehicleType;
  if (statusGroup && STATUS_GROUPS[statusGroup]) {
    tripMatch.status = { $in: STATUS_GROUPS[statusGroup] };
  }
  if (dateFrom || dateTo) {
    const dateCond: Record<string, string> = {};
    if (dateFrom) dateCond.$gte = dateFrom;
    dateCond.$lte = dateTo || dateFrom!;
    tripMatch.date = dateCond;
  }

  const [total, rawTrips] = await Promise.all([
    Trip.countDocuments(tripMatch),
    Trip.find(tripMatch)
      .sort({ date: 1, cycleIndex: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<
        {
          _id: unknown;
          tripNumber: number;
          requestId: unknown;
          date: string;
          paymentStatus: string;
          status: string;
          vehicleType: string;
          pickup: GeoPoint;
          dropoff: GeoPoint;
          pickupTime: string;
          arrivalTime: string;
          priceEgp: number;
          distanceKm: number;
          durationMinutes: number;
          createdAt: Date | string;
        }[]
      >(),
  ]);

  const requestIds = Array.from(
    new Set(rawTrips.map((t) => String(t.requestId))),
  );
  const requests = await RequestModel.find({ _id: { $in: requestIds } })
    .select("amountEgp")
    .lean<{ _id: unknown; amountEgp: number }[]>();
  const amountByRequestId = new Map(
    requests.map((r) => [String(r._id), r.amountEgp]),
  );

  return {
    total,
    page,
    rows: rawTrips.map((trip) => ({
      id: String(trip._id),
      tripNumber: trip.tripNumber,
      requestId: String(trip.requestId),
      date: trip.date,
      paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
      status: (trip.status as BookingStatus) ?? "pending_payment",
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
      distanceKm: trip.distanceKm,
      durationMinutes: trip.durationMinutes,
      bookingAmountEgp:
        amountByRequestId.get(String(trip.requestId)) ?? trip.priceEgp,
      createdAt:
        trip.createdAt instanceof Date
          ? trip.createdAt.toISOString()
          : String(trip.createdAt),
    })),
  };
}

export async function listUserTrips(
  userId: string,
  {
    page,
    pageSize = 12,
    paymentStatus,
    vehicleType,
    statusGroup,
    dateFrom,
    dateTo,
  }: ListUserTripsOptions,
): Promise<{ rows: TripListRow[]; total: number; page: number }> {
  await connectDB();

  const tripMatch: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
  };
  if (paymentStatus) tripMatch.paymentStatus = paymentStatus;
  if (vehicleType) tripMatch.vehicleType = vehicleType;
  if (statusGroup && STATUS_GROUPS[statusGroup]) {
    tripMatch.status = { $in: STATUS_GROUPS[statusGroup] };
  }
  if (dateFrom || dateTo) {
    const dateCond: Record<string, string> = {};
    if (dateFrom) dateCond.$gte = dateFrom;
    dateCond.$lte = dateTo || dateFrom!;
    tripMatch.date = dateCond;
  }

  const [total, rawTrips] = await Promise.all([
    Trip.countDocuments(tripMatch),
    Trip.find(tripMatch)
      .sort({ date: 1, cycleIndex: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<
        {
          _id: unknown;
          tripNumber: number;
          requestId: unknown;
          date: string;
          paymentStatus: string;
          status: string;
          vehicleType: string;
          pickup: GeoPoint;
          dropoff: GeoPoint;
          pickupTime: string;
          arrivalTime: string;
          priceEgp: number;
          distanceKm: number;
          durationMinutes: number;
          createdAt: Date | string;
        }[]
      >(),
  ]);

  const requestIds = Array.from(
    new Set(rawTrips.map((t) => String(t.requestId))),
  );
  const requests = await RequestModel.find({ _id: { $in: requestIds } })
    .select("amountEgp")
    .lean<{ _id: unknown; amountEgp: number }[]>();
  const amountByRequestId = new Map(
    requests.map((r) => [String(r._id), r.amountEgp]),
  );

  return {
    total,
    page,
    rows: rawTrips.map((trip) => ({
      id: String(trip._id),
      tripNumber: trip.tripNumber,
      requestId: String(trip.requestId),
      date: trip.date,
      paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
      status: (trip.status as BookingStatus) ?? "pending_payment",
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
      distanceKm: trip.distanceKm,
      durationMinutes: trip.durationMinutes,
      bookingAmountEgp:
        amountByRequestId.get(String(trip.requestId)) ?? trip.priceEgp,
      createdAt:
        trip.createdAt instanceof Date
          ? trip.createdAt.toISOString()
          : String(trip.createdAt),
    })),
  };
}

export interface UserTripDetail {
  id: string;
  tripNumber: number;
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
  pickupStationOptions: StationOption[];
  dropoffStationOptions: StationOption[];
  passengers: {
    sameAsMain: boolean;
    pickup?: GeoPoint | null;
    dropoff?: GeoPoint | null;
  }[];
  numberOfPassengers: number;
  stops: {
    point: GeoPoint;
    alighting: number;
    boarding: number;
    waitingMinutes: number;
  }[];
  paymentStatus: PaymentStatus;
  status: string;
  createdAt: string;
}

export async function getDriverTrip(
  driverId: string,
  tripId: string,
): Promise<UserTripDetail | null> {
  if (!Types.ObjectId.isValid(tripId)) return null;

  await connectDB();
  const trip = await Trip.findOne({
    _id: tripId,
    driverId: new Types.ObjectId(driverId),
  }).lean<{
    _id: unknown;
    tripNumber: number;
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
    pickupStationOptions?: StationOption[];
    dropoffStationOptions?: StationOption[];
    passengers: {
      sameAsMain: boolean;
      pickup?: GeoPoint | null;
      dropoff?: GeoPoint | null;
    }[];
    numberOfPassengers: number;
    stops: {
      point: GeoPoint;
      alighting: number;
      boarding: number;
      waitingMinutes: number;
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
    pickupStationOptions: trip.pickupStationOptions ?? [],
    dropoffStationOptions: trip.dropoffStationOptions ?? [],
    createdAt:
      trip.createdAt instanceof Date
        ? trip.createdAt.toISOString()
        : String(trip.createdAt),
  };
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
    tripNumber: number;
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
    pickupStationOptions?: StationOption[];
    dropoffStationOptions?: StationOption[];
    passengers: {
      sameAsMain: boolean;
      pickup?: GeoPoint | null;
      dropoff?: GeoPoint | null;
    }[];
    numberOfPassengers: number;
    stops: {
      point: GeoPoint;
      alighting: number;
      boarding: number;
      waitingMinutes: number;
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
    pickupStationOptions: trip.pickupStationOptions ?? [],
    dropoffStationOptions: trip.dropoffStationOptions ?? [],
    createdAt:
      trip.createdAt instanceof Date
        ? trip.createdAt.toISOString()
        : String(trip.createdAt),
  };
}
