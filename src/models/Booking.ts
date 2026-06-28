import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const PointSchema = new Schema(
  {
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const TripSchema = new Schema(
  {
    pickup: { type: PointSchema, required: true },
    dropoff: { type: PointSchema, required: true },
    vehicleType: {
      type: String,
      required: true,
      enum: [
        "private_car",
        "taxi_private",
        "taxi_shared",
        "van_shared",
        "microbus_shared",
      ],
    },
    rideType: { type: String, required: true, enum: ["private", "shared"] },
    arrivalTime: { type: String, required: true }, // "HH:MM"
    pickupTime: { type: String, required: true }, // "HH:MM" — single computed field
    distanceKm: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    priceEgp: { type: Number, required: true }, // server-recomputed
  },
  { _id: true },
);

const BookingSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    trips: {
      type: [TripSchema],
      required: true,
      validate: (v: unknown[]) => v.length > 0,
    },
    amountEgp: { type: Number, required: true }, // server sum of trips[].priceEgp

    // ── Payment (Kashier) ──
    paymentStatus: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "paid", "failed", "refunded"],
    },
    kashierSessionId: { type: String },
    kashierOrderId: { type: String }, // = booking _id sent as orderId
    paidAt: { type: Date },

    // ── Ride lifecycle ──
    status: {
      type: String,
      required: true,
      default: "pending_payment",
      enum: [
        "pending_payment",
        "submitted",
        "matching",
        "confirmed",
        "active",
        "completed",
        "cancelled",
      ],
    },
  },
  { timestamps: true },
);

export type BookingDoc = InferSchemaType<typeof BookingSchema>;
export const Booking = models.Booking || model("Booking", BookingSchema);
