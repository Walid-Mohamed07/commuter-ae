import { NextRequest, NextResponse } from "next/server";

const KEY =
  process.env.GOOGLE_MAPS_API_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json",
  );
  url.searchParams.set("input", q);
  url.searchParams.set("key", KEY);
  url.searchParams.set("components", "country:eg");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json([], { status: 502 });

  const data = await res.json();
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("[places/autocomplete]", data.status, data.error_message);
  }
  const results = (data.predictions ?? []).map(
    (p: { place_id: string; description: string }) => ({
      place_id: p.place_id,
      display_name: p.description,
    }),
  );
  return NextResponse.json(results);
}
