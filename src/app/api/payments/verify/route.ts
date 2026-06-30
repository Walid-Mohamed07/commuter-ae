import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { verifyAndSettleBooking } from "@/lib/payments/kashier";

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

  const paymentStatus = await verifyAndSettleBooking(bookingId, session.userId);
  return NextResponse.json({ paymentStatus });
}
