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
    rideType: { type: String, required: true, enum: ["private", "shared"] }, // derived from vehicleType
    arrivalTime: { type: String, required: true }, // "HH:MM" (all vehicles)
    pickupFrom: { type: String, required: true }, // "HH:MM" computed
    pickupTo: { type: String, required: true }, // "HH:MM" computed
    distanceKm: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    priceEgp: { type: Number, required: true }, // priceFor() — server-recomputed, never trusted from client
  },
  { _id: true },
);

const BookingSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" (one of next 7 days)
    trips: {
      type: [TripSchema],
      required: true,
      validate: (v: unknown[]) => v.length > 0,
    },
    status: {
      type: String,
      required: true,
      default: "submitted",
      enum: [
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
