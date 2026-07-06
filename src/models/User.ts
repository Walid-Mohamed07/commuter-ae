import { Schema, model, models, type InferSchemaType } from "mongoose";

const SavedAddressSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: true },
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    savedAddresses: { type: [SavedAddressSchema], default: [] },
  },
  { timestamps: true }, // createdAt, updatedAt
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = models.User || model("User", UserSchema);
