import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/models/Booking";

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Expires bookings that have been in pending_payment / pending state for
 * more than 2 hours.  Safe to call multiple times (idempotent).
 *
 * Protected by an optional CRON_SECRET env var.
 * Set Authorization: Bearer <CRON_SECRET> when calling from a cron service.
 * If CRON_SECRET is unset the endpoint is open (fine for private/internal use).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await connectDB();

  const cutoff = new Date(Date.now() - EXPIRY_MS);

  const result = await Booking.updateMany(
    {
      status: "pending_payment",
      paymentStatus: { $in: ["pending", "failed"] },
      createdAt: { $lte: cutoff },
    },
    { $set: { status: "time_out", paymentStatus: "expired" } },
  );

  return NextResponse.json({ expired: result.modifiedCount });
}

// Allow Vercel Cron to call via GET as well
export const GET = POST;
