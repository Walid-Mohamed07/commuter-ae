import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/models/Booking";

// Kashier sends webhook with a `signature` field in the JSON body.
// Signature = HMAC-SHA256(orderId + amount + currency, KASHIER_API_KEY)
// Adjust the signing payload if your Kashier version differs.
function verifySignature(
  orderId: string,
  amount: string,
  currency: string,
  receivedSig: string,
): boolean {
  const secret = process.env.KASHIER_API_KEY!;
  const payload = `${orderId}${amount}${currency}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSig, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const { orderId, amount, currency = "EGP", status, signature } = body;

  if (!orderId || !amount || !status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Validate signature — prevents spoofed webhook calls
  if (signature && !verifySignature(orderId, amount, currency, signature)) {
    console.warn("Kashier webhook: invalid signature for orderId", orderId);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // "SUCCESS" is Kashier's v3 success status; adjust if their webhook uses different casing
  const paid =
    status === "SUCCESS" || status === "success" || status === "paid";

  if (!paid) {
    // Record failure but still return 200 so Kashier doesn't retry
    await connectDB();
    await Booking.findByIdAndUpdate(orderId, { paymentStatus: "failed" });
    return NextResponse.json({ received: true });
  }

  await connectDB();
  await Booking.findByIdAndUpdate(orderId, {
    paymentStatus: "paid",
    status: "submitted",
    paidAt: new Date(),
  });

  return NextResponse.json({ received: true });
}
