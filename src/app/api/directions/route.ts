import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const dest = req.nextUrl.searchParams.get("dest");
  if (!origin || !dest)
    return NextResponse.json({ error: "missing origin/dest" }, { status: 400 });

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", dest);
  url.searchParams.set("key", KEY);
  url.searchParams.set("mode", "driving");
  const wps = req.nextUrl.searchParams.get("waypoints");
  if (wps) url.searchParams.set("waypoints", wps);

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json([], { status: 502 });

  const data = await res.json();
  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg) return NextResponse.json([]);

  const encoded: string = data.routes[0].overview_polyline.points;
  const coords = decodePolyline(encoded);

  return NextResponse.json([
    {
      coordinates: coords,
      distance_km: Math.round((leg.distance.value / 1000) * 10) / 10,
      duration_minutes: Math.round(leg.duration.value / 60),
    },
  ]);
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let i = 0,
    lat = 0,
    lng = 0;
  while (i < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}
