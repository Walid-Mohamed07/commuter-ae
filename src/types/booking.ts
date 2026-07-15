import type { LatLng } from "./geo";

// ── Status enums (single source of truth; were duplicated across pages) ───────

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "expired";

export type BookingStatus =
  | "pending_payment"
  | "submitted"
  | "matching"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "time_out";

/** A Trip's lifecycle status uses the same enum as its parent Booking. */
export type TripStatus = BookingStatus;

// ── API / view-model row shapes ───────────────────────────────────────────────

/** Flat trip row for the /my-trips history list and GET /api/trips. */
export interface TripListRow {
  id: string;
  requestId: string;
  date: string;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  pickupTime: string;
  arrivalTime: string;
  priceEgp: number;
  distanceKm: number;
  durationMinutes: number;
  bookingAmountEgp: number;
  createdAt: string;
}

/** Trip summary nested inside a booking card (/my-requests). */
export interface BookingTripRow {
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  pickupTime: string;
  arrivalTime: string;
  priceEgp: number;
}

/** A booking (one date + its trips) for the /my-requests list and GET /api/requests. */
export interface BookingRow {
  id: string;
  dates: string[];
  trips: BookingTripRow[];
  amountEgp: number;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  createdAt: string;
}
