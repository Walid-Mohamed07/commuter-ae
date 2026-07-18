import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { nextSequence } from "@/models/Counter";
import { createSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json();

    if (!name?.trim() || !phone?.trim() || !password)
      return NextResponse.json(
        { error: "Name, phone and password are required." },
        { status: 400 },
      );
    if (password.length < 8)
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );

    await connectDB();

    const existing = await User.findOne({
      phone: phone.trim(),
      role: "passenger",
    }).lean();
    if (existing)
      return NextResponse.json(
        { error: "An account with this phone number already exists." },
        { status: 409 },
      );

    if (email?.trim()) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase().trim(),
        role: "passenger",
      }).lean();
      if (existingEmail)
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 },
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userNumber = await nextSequence("userNumber");
    const user = await User.create({
      userNumber,
      name: name.trim(),
      phone: phone.trim(),
      passwordHash,
      email: email?.trim() ? email.toLowerCase().trim() : undefined,
      role: "passenger",
    });

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role: "passenger",
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
