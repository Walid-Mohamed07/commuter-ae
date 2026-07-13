import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { debitWallet, creditWallet } from "@/lib/wallet/wallet";
import { Types } from "mongoose";

/**
 * Pay for a booking using the user's wallet balance.
 * Recomputes nothing about price — uses the server-stored amountEgp.
 * The debit is atomic (balance-guarded), and the booking is only marked paid
 * if the debit succeeds.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let bookingId: string;
  try {
    ({ bookingId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!bookingId || !Types.ObjectId.isValid(bookingId))
    return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

  await connectDB();

  const booking = await Request.findOne({
    _id: bookingId,
    userId: new Types.ObjectId(session.userId),
    paymentStatus: { $in: ["pending", "failed"] },
  });

  if (!booking)
    return NextResponse.json(
      { error: "Request not found or already paid." },
      { status: 404 },
    );

  const amount = booking.amountEgp;

  const newBalance = await debitWallet(session.userId, amount, {
    description: `Payment for booking ${booking._id}`,
    bookingId: String(booking._id),
  });

  if (newBalance === null) {
    return NextResponse.json(
      { error: "Insufficient wallet balance." },
      { status: 402 },
    );
  }

  // Settle the request — conditional so a racing card webhook can't double-pay.
  const settled = await Request.findOneAndUpdate(
    { _id: booking._id, paymentStatus: { $in: ["pending", "failed"] } },
    {
      paymentStatus: "paid",
      status: "submitted",
      paidAt: new Date(),
    },
  );

  // Lost the race (request already paid elsewhere) — refund the debit.
  if (!settled) {
    await creditWallet(session.userId, amount, {
      description: `Refund — request ${booking._id} already paid`,
      type: "refund",
    });
    return NextResponse.json(
      { error: "Booking was already paid. Your wallet was not charged." },
      { status: 409 },
    );
  }

  // Sync all materialized Trips for this request.
  await Trip.updateMany(
    { requestId: booking._id },
    { paymentStatus: "paid", status: "submitted" },
  );

  return NextResponse.json({ paymentStatus: "paid", balanceEgp: newBalance });
}
