import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import type { BookingStatus, PaymentStatus } from "@/types/booking";

export interface BookingStatusDetail {
  id: string;
  paymentStatus: PaymentStatus;
  amountEgp: number;
  status: BookingStatus;
  dates: string[];
}

export async function getBookingStatus(
  userId: string,
  bookingId: string,
): Promise<BookingStatusDetail | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;

  await connectDB();
  const booking = await Request.findOne({
    _id: bookingId,
    userId: new Types.ObjectId(userId),
  })
    .select("paymentStatus amountEgp status dates")
    .lean<{
      _id: unknown;
      paymentStatus: string;
      amountEgp: number;
      status: string;
      dates: string[];
    }>();
  if (!booking) return null;

  return {
    id: String(booking._id),
    paymentStatus: (booking.paymentStatus as PaymentStatus) ?? "pending",
    amountEgp: booking.amountEgp,
    status: booking.status as BookingStatus,
    dates: booking.dates ?? [],
  };
}
