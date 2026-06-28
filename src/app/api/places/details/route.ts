import { NextRequest, NextResponse } from "next/server";

const KEY =
  process.env.GOOGLE_MAPS_API_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  url.searchParams.set("place_id", id);
  url.searchParams.set("fields", "geometry");
  url.searchParams.set("key", KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

  const data = await res.json();
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("[places/autocomplete]", data.status, data.error_message);
  }
  const loc = data.result?.geometry?.location;
  if (!loc) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ lat: loc.lat, lng: loc.lng });
}
