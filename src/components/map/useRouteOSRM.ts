import { useState, useEffect, useRef } from 'react';
import { fetchRoadRoute, type Waypoint, type OSRMRoute } from '@/lib/osrm';

interface UseRouteResult {
  route: OSRMRoute | null;
  loading: boolean;
  error: string | null;
}

export function useRouteOSRM(waypoints: Waypoint[]): UseRouteResult {
  const [route,   setRoute]   = useState<OSRMRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Stable ref so the effect body always sees the latest waypoints
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;

  // Primitive key triggers the effect only when coordinates actually change
  const waypointsKey = JSON.stringify(waypoints);

  useEffect(() => {
    const wps = waypointsRef.current;
    if (wps.length < 2) return;
    setLoading(true);
    setError(null);

    fetchRoadRoute(wps)
      .then((r) => setRoute(r))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [waypointsKey]); // waypointsKey is a primitive — no complex-expression warning

  return { route, loading, error };
}
