import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const PointSchema = new Schema(
  {
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const AvailabilitySchema = new Schema(
  {
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    startLocation: { type: PointSchema, required: true },
    endLocation: { type: PointSchema, required: true },
    startTime: { type: String, required: true }, // "HH:MM"
    endTime: { type: String, required: true }, // "HH:MM"
  },
  { timestamps: true },
);

export type AvailabilityDoc = InferSchemaType<typeof AvailabilitySchema>;
export const Availability =
  models.Availability || model("Availability", AvailabilitySchema);
