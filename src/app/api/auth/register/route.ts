import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json();

    if (!name?.trim() || !email?.trim() || !password)
      return NextResponse.json(
        { error: "Name, email and password are required." },
        { status: 400 },
      );
    if (password.length < 8)
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );

    await connectDB();

    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
    }).lean();
    if (existing)
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      phone: phone?.trim() || undefined,
    });

    await createSession({ userId: String(user._id), email: user.email });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
