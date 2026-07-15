export interface Station {
  id: number;
  name: string;
  lat: number;
  lng: number;
  popupInfo: string;
}

export interface StationOption {
  id: number;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  walkingMin: number;
}

const SHARED_TYPES = new Set(["taxi_shared", "van_shared", "microbus_shared"]);

export function isSharedVehicle(vehicleType: string): boolean {
  return SHARED_TYPES.has(vehicleType);
}

/** Haversine great-circle distance in km */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Walking time in minutes at 4.5 km/h, rounded up */
export function walkingMinutes(distKm: number): number {
  return Math.ceil((distKm / 4.5) * 60);
}

/** Returns nearest station options by haversine distance */
export function findNearestStations(
  lat: number,
  lng: number,
  stations: Station[],
  limit = 5,
): StationOption[] {
  return stations
    .map((station) => {
      const distanceKm = haversineKm(lat, lng, station.lat, station.lng);
      return {
        id: station.id,
        name: station.name,
        lat: station.lat,
        lng: station.lng,
        distanceKm: Math.round(distanceKm * 100) / 100,
        walkingMin: walkingMinutes(distanceKm),
      };
    })
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, Math.max(0, limit));
}

/** Returns nearest station by haversine, or null when list is empty */
export function findNearestStation(
  lat: number,
  lng: number,
  stations: Station[],
): Station | null {
  if (!stations.length) return null;
  let nearest = stations[0];
  let minDist = haversineKm(lat, lng, stations[0].lat, stations[0].lng);
  for (let i = 1; i < stations.length; i++) {
    const d = haversineKm(lat, lng, stations[i].lat, stations[i].lng);
    if (d < minDist) {
      minDist = d;
      nearest = stations[i];
    }
  }
  return nearest;
}
