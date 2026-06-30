import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

/**
 * Wallet ledger. Every balance movement is recorded here.
 * - topup:   user adds funds (settled via Kashier). Starts `pending`, becomes
 *            `completed` once the gateway confirms, then credits the wallet.
 * - payment: funds spent paying for a booking (always `completed`).
 * - refund:  funds returned to the wallet.
 */
const WalletTransactionSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["topup", "payment", "refund"],
    },
    amountEgp: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      default: "completed",
      enum: ["pending", "completed", "failed"],
    },
    description: { type: String, required: true },
    balanceAfterEgp: { type: Number },
    bookingId: { type: Types.ObjectId, ref: "Booking" },

    // ── Kashier (topup only) ──
    kashierSessionId: { type: String },
    kashierOrderId: { type: String },
  },
  { timestamps: true },
);

export type WalletTransactionDoc = InferSchemaType<
  typeof WalletTransactionSchema
>;
export const WalletTransaction =
  models.WalletTransaction ||
  model("WalletTransaction", WalletTransactionSchema);
