import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/models/Booking";
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

  let groupId: string | undefined;
  let bookingId: string | undefined;
  try {
    ({ groupId, bookingId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!groupId && (!bookingId || !Types.ObjectId.isValid(bookingId)))
    return NextResponse.json({ error: "Invalid groupId or bookingId" }, { status: 400 });

  await connectDB();

  const query = groupId
    ? { groupId, userId: new Types.ObjectId(session.userId) }
    : { _id: bookingId, userId: new Types.ObjectId(session.userId) };

  const bookings = await Booking.find({
    ...query,
    paymentStatus: { $in: ["pending", "failed"] },
  });

  if (!bookings.length)
    return NextResponse.json(
      { error: "Booking not found or already paid." },
      { status: 404 },
    );

  const amount = bookings.reduce((sum, b) => sum + b.amountEgp, 0);
  const refLabel = groupId ?? String(bookings[0]._id);

  const newBalance = await debitWallet(session.userId, amount, {
    description: `Payment for booking(s) ${refLabel}`,
    bookingId: refLabel,
  });

  if (newBalance === null) {
    return NextResponse.json(
      { error: "Insufficient wallet balance." },
      { status: 402 },
    );
  }

  // Settle all bookings — conditional so a racing card webhook can't double-pay.
  const settleFilter = groupId
    ? { groupId, paymentStatus: { $in: ["pending", "failed"] } }
    : { _id: bookings[0]._id, paymentStatus: { $in: ["pending", "failed"] } };

  const settled = await Booking.updateMany(settleFilter, {
    paymentStatus: "paid",
    status: "submitted",
    paidAt: new Date(),
  });

  // Lost the race (bookings already paid elsewhere) — refund the debit.
  if (!settled.modifiedCount) {
    await creditWallet(session.userId, amount, {
      description: `Refund — booking(s) ${refLabel} already paid`,
      type: "refund",
    });
    return NextResponse.json(
      { error: "Booking was already paid. Your wallet was not charged." },
      { status: 409 },
    );
  }

  return NextResponse.json({ paymentStatus: "paid", balanceEgp: newBalance });
}
