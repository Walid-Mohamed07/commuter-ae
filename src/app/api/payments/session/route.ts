import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/models/Booking";
import { Types } from "mongoose";

const KASHIER_URL =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io/v3/payment/sessions"
    : "https://test-api.kashier.io/v3/payment/sessions";

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

  const orderId = groupId ?? String(bookings[0]._id);
  const amountEgp = bookings.reduce((sum, b) => sum + b.amountEgp, 0);

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "APP_URL is not configured on the server." },
      { status: 500 },
    );
  }
  const expireAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body = {
    merchantOrderId: orderId,
    merchantId: process.env.KASHIER_MERCHANT_ID!,
    amount: String(amountEgp),
    currency: "EGP",
    // order: String(booking._id),
    // mode: process.env.KASHIER_MODE ?? "test",
    paymentType: "credit",
    type: "one-time",
    maxFailureAttempts: 3,
    expireAt,
    display: "en",
    allowedMethods: "card,wallet",
    customer: {
      email: session.email,
      reference: String(session.userId),
    },
    merchantRedirect: groupId
      ? `${appUrl}/checkout/callback?groupId=${groupId}`
      : `${appUrl}/checkout/callback?bookingId=${orderId}`,
    serverWebhook: `${appUrl}/api/payments/webhook`,
  };

  let kashierRes: Response;
  try {
    kashierRes = await fetch(KASHIER_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.KASHIER_SECRET_KEY!,
        "api-key": process.env.KASHIER_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach payment gateway." },
      { status: 502 },
    );
  }

  const kashierData = await kashierRes.json();

  if (!kashierRes.ok || !kashierData?.sessionUrl) {
    console.error("Kashier session error:", kashierData);
    return NextResponse.json(
      { error: "Payment gateway rejected the request." },
      { status: 502 },
    );
  }

  await Booking.updateMany(
    { _id: { $in: bookings.map((b) => b._id) } },
    {
      kashierSessionId: kashierData._id ?? "",
      kashierOrderId: orderId,
    },
  );

  return NextResponse.json({ sessionUrl: kashierData.sessionUrl });
}
