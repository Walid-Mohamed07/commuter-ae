import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email?.trim() || !password)
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );

    await createSession({ userId: String(user._id), email: user.email });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
