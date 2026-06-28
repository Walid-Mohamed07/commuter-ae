import { NextRequest, NextResponse } from "next/server";

const KEY =
  process.env.GOOGLE_MAPS_API_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng)
    return NextResponse.json({ error: "missing lat/lng" }, { status: 400 });

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", KEY);
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

  const data = await res.json();
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("[places/autocomplete]", data.status, data.error_message);
  }
  const address = data.results?.[0]?.formatted_address ?? `${lat}, ${lng}`;
  return NextResponse.json({ address });
}
