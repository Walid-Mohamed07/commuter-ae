import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

// Trip assignment/matching is out of scope for now — always returns empty.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ trips: [] });
}
