import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { createSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { phone, password, role: rawRole } = await req.json();
    const role = rawRole === "driver" ? "driver" : "passenger";

    if (!phone?.trim() || !password)
      return NextResponse.json(
        { error: "Phone and password are required." },
        { status: 400 },
      );

    await connectDB();

    console.log(
      "Phase 1: Database connection established. Proceeding to find user.",
    );

    const user = await User.findOne({ phone: phone.trim(), role });
    if (!user)
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
      );

    console.log("Phase 2: User found. Proceeding to password validation.");

    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log("Phase 3: Password validation completed. Valid:", valid);
    if (!valid)
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
      );

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role,
    });

    if (role !== "driver") return NextResponse.json({ ok: true, role });

    const driver = await Driver.findOne({ userId: user._id })
      .select("verificationStatus")
      .lean<{ verificationStatus?: string }>();
    return NextResponse.json({
      ok: true,
      role,
      verificationStatus: driver?.verificationStatus ?? "incomplete",
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
