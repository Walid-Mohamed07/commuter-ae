import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { getSession } from "@/lib/auth/session";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, phone } = await req.json();
    if (!name?.trim())
      return NextResponse.json({ error: "Name is required." }, { status: 400 });

    await connectDB();
    const user = await User.findByIdAndUpdate(
      session.userId,
      { name: name.trim(), phone: phone?.trim() || undefined },
      { new: true, select: "name email phone" },
    ).lean();

    if (!user)
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
