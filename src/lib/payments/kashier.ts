import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { creditWallet } from "@/lib/wallet/wallet";
import { Types } from "mongoose";

const BASE =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io"
    : "https://test-api.kashier.io";

type Settled = "pending" | "paid" | "failed";

/** Query Kashier for a session's payment outcome. Returns paid/failed/pending. */
async function queryKashierStatus(
  sessionId: string,
): Promise<"paid" | "failed" | "pending"> {
  if (!process.env.KASHIER_SECRET_KEY) return "pending";

  const url = `${BASE}/v3/payment/sessions/${encodeURIComponent(
    sessionId,
  )}/payment`;

  let data: Record<string, unknown> | null = null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: process.env.KASHIER_SECRET_KEY },
      cache: "no-store",
    });
    const json = (await res.json()) as Record<string, unknown>;
    data = (json.data ?? json.response ?? json) as Record<string, unknown>;
  } catch {
    return "pending";
  }

  const status = String(data?.status ?? "").toUpperCase();
  if (["SUCCESS", "CAPTURED", "PAID"].includes(status)) return "paid";
  if (["FAILED", "DECLINED", "ERROR", "EXPIRED"].includes(status))
    return "failed";
  return "pending";
}

/**
 * Query Kashier for the real payment status of a booking's session and settle
 * the booking in the DB. SOURCE OF TRUTH — do not rely on the webhook alone
 * (webhooks can fail or be delayed). Safe to call repeatedly (idempotent).
 */
export async function verifyAndSettleBooking(
  bookingId: string,
  userId?: string,
): Promise<Settled> {
  if (!Types.ObjectId.isValid(bookingId)) return "pending";

  await connectDB();

  const query: Record<string, unknown> = { _id: bookingId };
  if (userId) query.userId = new Types.ObjectId(userId);

  const booking = await Request.findOne(query);
  if (!booking) return "pending";

  // Already settled — nothing to do.
  if (booking.paymentStatus === "paid") return "paid";
  if (booking.paymentStatus === "failed") return "failed";

  if (!booking.kashierSessionId) return "pending";

  const outcome = await queryKashierStatus(booking.kashierSessionId);

  if (outcome === "paid") {
    // Conditional update — only settle if still unsettled (race-safe vs webhook)
    const settled = await Request.findOneAndUpdate(
      { _id: bookingId, paymentStatus: { $in: ["pending", "failed"] } },
      { paymentStatus: "paid", status: "submitted", paidAt: new Date() },
    );
    if (settled) {
      await Trip.updateMany(
        { requestId: settled._id },
        { paymentStatus: "paid", status: "submitted" },
      );
    }
    return "paid";
  }
  if (outcome === "failed") {
    await Request.findOneAndUpdate(
      { _id: bookingId, paymentStatus: "pending" },
      { paymentStatus: "failed" },
    );
    return "failed";
  }
  return "pending";
}

/**
 * Settle a pending wallet top-up against Kashier and credit the wallet on
 * success. Idempotent: the conditional status filter ensures the credit runs
 * at most once even if webhook + redirect both fire.
 */
export async function verifyAndSettleTopup(
  transactionId: string,
  userId?: string,
): Promise<Settled> {
  if (!Types.ObjectId.isValid(transactionId)) return "pending";

  await connectDB();

  const query: Record<string, unknown> = { _id: transactionId, type: "topup" };
  if (userId) query.userId = new Types.ObjectId(userId);

  const tx = await WalletTransaction.findOne(query);
  if (!tx) return "pending";

  if (tx.status === "completed") return "paid";
  if (tx.status === "failed") return "failed";
  if (!tx.kashierSessionId) return "pending";

  const outcome = await queryKashierStatus(tx.kashierSessionId);

  if (outcome === "paid") {
    // Claim the pending row atomically so the credit fires exactly once.
    const claimed = await WalletTransaction.findOneAndUpdate(
      { _id: tx._id, status: "pending" },
      { status: "completed" },
    );
    if (!claimed) return "paid"; // already claimed by another caller
    await creditWallet(String(tx.userId), tx.amountEgp, {
      description: tx.description,
      transactionId: String(tx._id),
    });
    return "paid";
  }
  if (outcome === "failed") {
    await WalletTransaction.findOneAndUpdate(
      { _id: tx._id, status: "pending" },
      { status: "failed" },
    );
    return "failed";
  }
  return "pending";
}

/**
 * Reconcile every still-pending top-up for a user against Kashier. Self-heals
 * cases where the redirect AND webhook both failed to settle a paid top-up.
 * Returns how many were newly credited.
 */
export async function reconcilePendingTopups(userId: string): Promise<number> {
  await connectDB();

  const pending = await WalletTransaction.find({
    userId: new Types.ObjectId(userId),
    type: "topup",
    status: "pending",
    kashierSessionId: { $exists: true, $ne: "" },
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  let credited = 0;
  for (const t of pending) {
    const outcome = await verifyAndSettleTopup(String(t._id), userId);
    if (outcome === "paid") credited += 1;
  }
  return credited;
}
