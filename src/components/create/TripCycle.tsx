"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  X,
  Clock,
  MapPin,
  Navigation,
  Info,
  RotateCcw,
} from "lucide-react";
import AddressInput from "@/components/landing/AddressInput";
import {
  VEHICLES,
  VEHICLE_LIST,
  priceFor,
  maxExtraPassengers,
  finalPrice,
  type VehicleKey,
  type VehicleConfig,
} from "@/lib/config/vehicles";
import { computePickupTime, toHHMM, toMinutes } from "@/lib/time/pickupWindow";
import { fetchRoute } from "@/lib/openrouteservice";
import type { TripPoint } from "@/lib/store/useTripStore";
import type { SavedAddress } from "@/types/shared";
import {
  isSharedVehicle,
  findNearestStation,
  haversineKm,
  walkingMinutes,
  type Station,
} from "@/lib/geo/stations";

export interface PassengerDetail {
  id: string;
  sameAsMain: boolean;
  pickup: TripPoint | null;
  dropoff: TripPoint | null;
}

export interface TripData {
  id: string;
  pickup: TripPoint | null;
  dropoff: TripPoint | null;
  vehicleType: VehicleKey;
  arrivalTime: string; // "HH:MM" 24h
  pickupTime: string; // computed
  distanceKm: number | null;
  durationMinutes: number | null;
  priceEgp: number | null;
  routeCoordinates: [number, number][] | null;
  extraPassengers: number;
  returnTrip?: boolean; // UI flag — reverse of source trip
  pickupStation: { lat: number; lng: number; name: string } | null;
  dropoffStation: { lat: number; lng: number; name: string } | null;
  walkingMinToStation: number | null; // walk from pickup → pickup station
  walkingMinFromStation: number | null; // walk from dropoff station → dropoff
  passengers: PassengerDetail[]; // per-extra-passenger detail (private vehicles may set distinct points)
  baseDistanceKm: number | null; // main pickup→dropoff distance (reference for 25% detour cap)
  passengerDetourKm: number | null; // last computed combined route distance through distinct passenger points
}

interface Props {
  data: TripData;
  index: number;
  canRemove: boolean;
  onChange: (updated: TripData) => void;
  onRemove: () => void;
  picking?: "pickup" | "dropoff" | null;
  onPickFromMap?: (field: "pickup" | "dropoff") => void;
  sourceTripData?: TripData | null; // trips[0] for return-trip toggle
  savedAddresses?: SavedAddress[];
  stations?: Station[];
  minArrivalTime?: string | null; // earliest valid arrival for this trip
  onAddressSaved?: (saved: SavedAddress) => void;
  vehiclesMap?: Record<VehicleKey, VehicleConfig>; // DB-hydrated vehicle config (falls back to static seed)
  vehicleList?: VehicleConfig[]; // DB-hydrated vehicle list for the select options
}

function pickBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    border: `1.5px solid ${active ? "#00C2A8" : "#e8edf0"}`,
    background: active ? "rgba(0,194,168,0.1)" : "#f8f9fa",
    color: active ? "#00897B" : "#5A6A7A",
  };
}

/** Render "HH:MM" 24h as 12h am/pm */
function to12h(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Helper — check if a point is already saved
function isAlreadySaved(pt: TripPoint, saved: SavedAddress[]): boolean {
  return saved.some(
    (s) =>
      Math.abs(s.lat - pt.lat) < 0.0001 && Math.abs(s.lng - pt.lng) < 0.0001,
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  display: "block",
  marginBottom: 6,
};

const readonlyStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px",
  height: 52,
  background: "#f0f4f8",
  borderRadius: 12,
  border: "1.5px solid #e8edf0",
  cursor: "not-allowed",
};

export default function TripCycle({
  data,
  index,
  canRemove,
  onChange,
  onRemove,
  picking,
  onPickFromMap,
  sourceTripData,
  savedAddresses = [],
  stations = [],
  minArrivalTime,
  onAddressSaved,
  vehiclesMap,
  vehicleList,
}: Props) {
  const [routeLoading, setRouteLoading] = useState(false);
  const vMap = vehiclesMap ?? VEHICLES;
  const vList = vehicleList ?? VEHICLE_LIST;

  function handleReturnToggle(checked: boolean) {
    if (checked && sourceTripData) {
      // Swap pickup/dropoff from source trip
      onChange({
        ...data,
        returnTrip: true,
        pickup: sourceTripData.dropoff,
        dropoff: sourceTripData.pickup,
        arrivalTime: "",
        pickupTime: "",
        distanceKm: null,
        durationMinutes: null,
        priceEgp: null,
        routeCoordinates: null,
        pickupStation: null,
        dropoffStation: null,
        walkingMinToStation: null,
        walkingMinFromStation: null,
        passengers: [],
        baseDistanceKm: null,
        passengerDetourKm: null,
      });
    } else {
      onChange({
        ...data,
        returnTrip: false,
        pickup: null,
        dropoff: null,
        arrivalTime: "",
        pickupTime: "",
        distanceKm: null,
        durationMinutes: null,
        priceEgp: null,
        routeCoordinates: null,
        pickupStation: null,
        dropoffStation: null,
        walkingMinToStation: null,
        walkingMinFromStation: null,
        passengers: [],
        baseDistanceKm: null,
        passengerDetourKm: null,
      });
    }
  }

  /* ── Auto-fetch route when both pickup+dropoff filled ── */
  useEffect(() => {
    if (!data.pickup || !data.dropoff) {
      onChange({
        ...data,
        distanceKm: null,
        durationMinutes: null,
        priceEgp: null,
        pickupTime: "",
        routeCoordinates: null,
        pickupStation: null,
        dropoffStation: null,
        walkingMinToStation: null,
        walkingMinFromStation: null,
        baseDistanceKm: null,
        passengerDetourKm: null,
      });
      return;
    }

    const shared = isSharedVehicle(data.vehicleType);

    // For shared vehicles snap pickup/dropoff to nearest station
    let routeFrom: TripPoint = data.pickup;
    let routeTo: TripPoint = data.dropoff;
    let nearPickupStation: { lat: number; lng: number; name: string } | null =
      null;
    let nearDropoffStation: { lat: number; lng: number; name: string } | null =
      null;
    let walkMinToStation: number | null = null;
    let walkMinFromStation: number | null = null;

    if (shared && stations.length > 0) {
      const ps = findNearestStation(data.pickup.lat, data.pickup.lng, stations);
      const ds = findNearestStation(
        data.dropoff.lat,
        data.dropoff.lng,
        stations,
      );
      if (ps) {
        nearPickupStation = { lat: ps.lat, lng: ps.lng, name: ps.name };
        walkMinToStation = walkingMinutes(
          haversineKm(data.pickup.lat, data.pickup.lng, ps.lat, ps.lng),
        );
        routeFrom = { address: ps.name, lat: ps.lat, lng: ps.lng };
      }
      if (ds) {
        nearDropoffStation = { lat: ds.lat, lng: ds.lng, name: ds.name };
        walkMinFromStation = walkingMinutes(
          haversineKm(ds.lat, ds.lng, data.dropoff.lat, data.dropoff.lng),
        );
        routeTo = { address: ds.name, lat: ds.lat, lng: ds.lng };
      }
    }

    let cancelled = false;
    setRouteLoading(true);
    fetchRoute([routeFrom, routeTo])
      .then((routes) => {
        if (cancelled || !routes.length) return;
        const { distance_km, duration_minutes, coordinates } = routes[0];
        const price = priceFor(distance_km, data.vehicleType, vMap);
        // For shared: also subtract walk-from-station time from arrival before computing pickup
        const extraWalk = walkMinFromStation ?? 0;
        const pt = data.arrivalTime
          ? computePickupTime(
              data.arrivalTime,
              duration_minutes + extraWalk,
              data.vehicleType,
              vMap,
            )
          : "";
        onChange({
          ...data,
          distanceKm: distance_km,
          durationMinutes: duration_minutes,
          priceEgp: price,
          pickupTime: pt,
          routeCoordinates: coordinates,
          pickupStation: nearPickupStation,
          dropoffStation: nearDropoffStation,
          walkingMinToStation: walkMinToStation,
          walkingMinFromStation: walkMinFromStation,
          baseDistanceKm: distance_km,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(data.pickup),
    JSON.stringify(data.dropoff),
    data.vehicleType,
    stations.length,
  ]);

  /* ── Passenger detour: combined route through distinct passenger points (private vehicles only) ── */
  useEffect(() => {
    if (!data.pickup || !data.dropoff) return;
    const isPrivate = !isSharedVehicle(data.vehicleType);
    const distinct = isPrivate
      ? (data.passengers ?? []).filter(
          (p) => !p.sameAsMain && p.pickup && p.dropoff,
        )
      : [];

    let cancelled = false;

    if (distinct.length === 0) {
      // Nothing distinct — ensure distanceKm reflects the base pickup→dropoff route.
      if (data.passengerDetourKm == null) return;
      fetchRoute([data.pickup, data.dropoff])
        .then((routes) => {
          if (cancelled || !routes.length) return;
          const { distance_km, duration_minutes, coordinates } = routes[0];
          const price = priceFor(distance_km, data.vehicleType, vMap);
          const pt = data.arrivalTime
            ? computePickupTime(
                data.arrivalTime,
                duration_minutes,
                data.vehicleType,
                vMap,
              )
            : data.pickupTime;
          onChange({
            ...data,
            distanceKm: distance_km,
            durationMinutes: duration_minutes,
            priceEgp: price,
            pickupTime: pt,
            routeCoordinates: coordinates,
            baseDistanceKm: distance_km,
            passengerDetourKm: null,
          });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    const waypoints = [
      data.pickup,
      ...distinct.map((p) => p.pickup!),
      ...distinct.map((p) => p.dropoff!),
      data.dropoff,
    ];

    fetchRoute(waypoints)
      .then((routes) => {
        if (cancelled || !routes.length) return;
        const { distance_km, duration_minutes, coordinates } = routes[0];
        const base = data.baseDistanceKm ?? distance_km;
        const withinLimit = distance_km <= base * 1.25;
        if (withinLimit) {
          const price = priceFor(distance_km, data.vehicleType, vMap);
          const pt = data.arrivalTime
            ? computePickupTime(
                data.arrivalTime,
                duration_minutes,
                data.vehicleType,
                vMap,
              )
            : data.pickupTime;
          onChange({
            ...data,
            distanceKm: distance_km,
            durationMinutes: duration_minutes,
            priceEgp: price,
            pickupTime: pt,
            routeCoordinates: coordinates,
            passengerDetourKm: distance_km,
          });
        } else {
          onChange({ ...data, passengerDetourKm: distance_km });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(data.passengers),
    JSON.stringify(data.pickup),
    JSON.stringify(data.dropoff),
    data.vehicleType,
    data.baseDistanceKm,
  ]);

  /* ── Recompute pickup time when arrival, vehicle, or walking changes ── */
  useEffect(() => {
    if (!data.arrivalTime || !data.durationMinutes) return;
    const extraWalk = isSharedVehicle(data.vehicleType)
      ? (data.walkingMinFromStation ?? 0)
      : 0;
    const pt = computePickupTime(
      data.arrivalTime,
      data.durationMinutes + extraWalk,
      data.vehicleType,
      vMap,
    );
    if (pt !== data.pickupTime) onChange({ ...data, pickupTime: pt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.arrivalTime,
    data.vehicleType,
    data.durationMinutes,
    data.walkingMinFromStation,
  ]);

  /* ── Recompute price when vehicle changes ── */
  useEffect(() => {
    if (!data.distanceKm) return;
    const price = priceFor(data.distanceKm, data.vehicleType, vMap);
    if (price !== data.priceEgp) onChange({ ...data, priceEgp: price });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.vehicleType, data.distanceKm]);

  const set = useCallback(
    <K extends keyof TripData>(key: K, val: TripData[K]) => {
      onChange({ ...data, [key]: val });
    },
    [data, onChange],
  );

  // Pickup window end = start + 10 min margin
  const pickupWindowEnd = data.pickupTime
    ? toHHMM(toMinutes(data.pickupTime) + 10)
    : "";

  // Arrival time constraint check
  const arrivalTooEarly = !!(
    data.arrivalTime &&
    minArrivalTime &&
    toMinutes(data.arrivalTime) <= toMinutes(minArrivalTime)
  );

  // After pickupWindowEnd line
  const locationError: string | null = (() => {
    if (!data.pickup || !data.dropoff) return null;
    if (
      data.pickup.lat === data.dropoff.lat &&
      data.pickup.lng === data.dropoff.lng
    )
      return "Pickup and dropoff cannot be the same location.";
    // Use actual route distance once known; straight-line only as a pre-route fallback
    const dist =
      data.distanceKm ??
      haversineKm(
        data.pickup.lat,
        data.pickup.lng,
        data.dropoff.lat,
        data.dropoff.lng,
      );
    if (dist < 0.5)
      return "Minimum distance is 500 m — choose locations farther apart.";
    return null;
  })();

  // Extra-passenger detour: combined route (private vehicles) must not exceed 25% of base distance
  const detourExceeded =
    !isSharedVehicle(data.vehicleType) &&
    data.passengerDetourKm != null &&
    data.baseDistanceKm != null &&
    data.passengerDetourKm > data.baseDistanceKm * 1.25;

  function updatePassenger(id: string, patch: Partial<PassengerDetail>) {
    onChange({
      ...data,
      passengers: (data.passengers ?? []).map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });
  }

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        border: "1.5px solid #eef0f3",
        boxShadow: "0 2px 8px rgba(11,30,61,0.04)",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid #eef0f3",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          background: "#fafbfc",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: "#0B1E3D" }}>
          Trip {index + 1}
        </span>

        {/* Return trip checkbox — only for trips after the first */}
        {index > 0 && sourceTripData && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: data.returnTrip ? "#00897B" : "#5A6A7A",
              background: data.returnTrip ? "rgba(0,194,168,0.08)" : "#f0f4f8",
              border: `1.5px solid ${data.returnTrip ? "#00C2A8" : "#e8edf0"}`,
              borderRadius: 8,
              padding: "5px 10px",
              transition: "all 0.15s",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={!!data.returnTrip}
              onChange={(e) => handleReturnToggle(e.target.checked)}
              style={{
                width: 14,
                height: 14,
                accentColor: "#00C2A8",
                cursor: "pointer",
              }}
            />
            <RotateCcw size={12} aria-hidden="true" />
            Return trip
          </label>
        )}

        {data.priceEgp && (
          <span
            className="price-pop"
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: "#00C2A8",
              fontVariantNumeric: "tabular-nums",
              marginLeft: "auto",
            }}
          >
            {finalPrice(
              data.priceEgp,
              data.extraPassengers ?? 0,
              data.vehicleType,
            )}{" "}
            EGP
          </span>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove trip ${index + 1}`}
            style={{
              background: "rgba(231,76,60,0.08)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              color: "#e74c3c",
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              minHeight: 36,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(231,76,60,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(231,76,60,0.08)";
            }}
          >
            <X size={14} /> Remove
          </button>
        )}
      </div>

      {/* Form fields */}
      <div
        style={{
          padding: "18px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Vehicle type */}
        <div>
          <label htmlFor={`vehicle-${data.id}`} style={labelStyle}>
            Vehicle type{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <select
            id={`vehicle-${data.id}`}
            value={data.vehicleType}
            onChange={(e) => {
              const newVehicle = e.target.value as VehicleKey;
              const newMax = maxExtraPassengers(newVehicle);
              const clampedPassengers = Math.min(
                data.extraPassengers ?? 0,
                newMax,
              );
              // Sync passengers array AFTER extraPassengers is clamped — trim to
              // the new count; shared vehicles force everyone back to "same as main".
              const isPrivate = !isSharedVehicle(newVehicle);
              const syncedPassengers = Array.from(
                { length: clampedPassengers },
                (_, i) => {
                  const existing = (data.passengers ?? [])[i];
                  if (!isPrivate) {
                    return {
                      id: existing?.id ?? Math.random().toString(36).slice(2, 9),
                      sameAsMain: true,
                      pickup: null,
                      dropoff: null,
                    };
                  }
                  return (
                    existing ?? {
                      id: Math.random().toString(36).slice(2, 9),
                      sameAsMain: true,
                      pickup: null,
                      dropoff: null,
                    }
                  );
                },
              );
              const newPickupTime =
                data.arrivalTime && data.durationMinutes
                  ? computePickupTime(
                      data.arrivalTime,
                      data.durationMinutes,
                      newVehicle,
                      vMap,
                    )
                  : data.pickupTime;
              onChange({
                ...data,
                vehicleType: newVehicle,
                extraPassengers: clampedPassengers,
                passengers: syncedPassengers,
                pickupTime: newPickupTime,
              });
            }}
            style={{
              width: "100%",
              height: 52,
              padding: "0 14px",
              borderRadius: 12,
              border: "1.5px solid #e8edf0",
              background: "#f8f9fa",
              fontSize: 15,
              fontFamily: "inherit",
              color: "#0B1E3D",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235A6A7A' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
              paddingRight: 40,
              cursor: "pointer",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#00C2A8";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px rgba(0,194,168,0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e8edf0";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {vList.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Pickup */}
        <div>
          <label style={labelStyle}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Navigation
                size={13}
                style={{ color: "#0B1E3D" }}
                aria-hidden="true"
              />
              Pickup location{" "}
              <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                *
              </span>
            </span>
          </label>
          <AddressInput
            id={`pickup-${data.id}`}
            placeholder="Enter pickup address"
            value={data.pickup}
            onChange={(p) => set("pickup", p)}
            iconColor="#0B1E3D"
            savedAddresses={savedAddresses}
          />
          {data.pickup && !isAlreadySaved(data.pickup, savedAddresses) && (
            <SaveAddressButton
              point={data.pickup}
              onSaved={(s) => onAddressSaved?.(s)}
            />
          )}
          {onPickFromMap && (
            <button
              type="button"
              onClick={() => onPickFromMap("pickup")}
              style={pickBtnStyle(picking === "pickup")}
            >
              <MapPin size={13} aria-hidden="true" />
              {picking === "pickup" ? "Click the map…" : "Pick from map"}
            </button>
          )}
          {isSharedVehicle(data.vehicleType) &&
            data.pickup &&
            data.pickupStation && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                  fontSize: 12,
                  color: "#7A5000",
                  background: "rgba(245,166,35,0.1)",
                  border: "1px solid rgba(245,166,35,0.35)",
                  borderRadius: 8,
                  padding: "5px 10px",
                }}
              >
                <span aria-hidden="true">↪</span>
                <span>
                  Station: <strong>{data.pickupStation.name}</strong>
                  {data.walkingMinToStation != null
                    ? ` (~${data.walkingMinToStation} min walk)`
                    : ""}
                </span>
              </div>
            )}
        </div>

        {/* Dropoff */}
        <div>
          <label style={labelStyle}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin
                size={13}
                style={{ color: "#00C2A8" }}
                aria-hidden="true"
              />
              Dropoff location{" "}
              <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                *
              </span>
            </span>
          </label>
          <AddressInput
            id={`dropoff-${data.id}`}
            placeholder="Enter dropoff address"
            value={data.dropoff}
            onChange={(p) => set("dropoff", p)}
            iconColor="#00C2A8"
            savedAddresses={savedAddresses}
          />
          {data.dropoff && !isAlreadySaved(data.dropoff, savedAddresses) && (
            <SaveAddressButton
              point={data.dropoff}
              onSaved={(s) => onAddressSaved?.(s)}
            />
          )}
          {onPickFromMap && (
            <button
              type="button"
              onClick={() => onPickFromMap("dropoff")}
              style={pickBtnStyle(picking === "dropoff")}
            >
              <MapPin size={13} aria-hidden="true" />
              {picking === "dropoff" ? "Click the map…" : "Pick from map"}
            </button>
          )}
          {isSharedVehicle(data.vehicleType) &&
            data.dropoff &&
            data.dropoffStation && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                  fontSize: 12,
                  color: "#7A5000",
                  background: "rgba(245,166,35,0.1)",
                  border: "1px solid rgba(245,166,35,0.35)",
                  borderRadius: 8,
                  padding: "5px 10px",
                }}
              >
                <span aria-hidden="true">↪</span>
                <span>
                  Station: <strong>{data.dropoffStation.name}</strong>
                  {data.walkingMinFromStation != null
                    ? ` (~${data.walkingMinFromStation} min walk)`
                    : ""}
                </span>
              </div>
            )}
          {locationError && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: "#e74c3c",
                background: "rgba(231,76,60,0.07)",
                border: "1px solid rgba(231,76,60,0.2)",
                borderRadius: 8,
                padding: "8px 12px",
                marginTop: 6,
              }}
            >
              ⚠ {locationError}
            </div>
          )}
        </div>

        {/* Route info pill */}
        {routeLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#5A6A7A",
            }}
          >
            <Loader2 size={14} className="spin" aria-hidden="true" />
            Calculating route…
          </div>
        )}
        {!routeLoading && data.distanceKm && data.durationMinutes && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              background: "#eff7f6",
              borderRadius: 8,
              fontSize: 13,
              color: "#0B1E3D",
              fontWeight: 500,
            }}
          >
            <Info
              size={14}
              style={{ color: "#00C2A8", flexShrink: 0 }}
              aria-hidden="true"
            />
            <span>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {data.distanceKm} km
              </strong>
              {" · "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {data.durationMinutes} min
              </strong>
              {" drive"}
            </span>
          </div>
        )}

        {/* Arrival time */}
        <div>
          <label htmlFor={`arrival-${data.id}`} style={labelStyle}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock
                size={13}
                style={{ color: "#F5A623" }}
                aria-hidden="true"
              />
              Arrival time{" "}
              <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                *
              </span>
            </span>
          </label>
          <input
            id={`arrival-${data.id}`}
            type="time"
            value={data.arrivalTime}
            min={minArrivalTime ?? undefined}
            onChange={(e) => set("arrivalTime", e.target.value)}
            required
            style={{
              width: "100%",
              height: 52,
              padding: "0 14px",
              borderRadius: 12,
              border: `1.5px solid ${arrivalTooEarly ? "#e74c3c" : "#e8edf0"}`,
              background: "#f8f9fa",
              fontSize: 15,
              fontFamily: "inherit",
              color: "#0B1E3D",
              boxSizing: "border-box",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = arrivalTooEarly
                ? "#e74c3c"
                : "#00C2A8";
              e.currentTarget.style.boxShadow = arrivalTooEarly
                ? "0 0 0 3px rgba(231,76,60,0.12)"
                : "0 0 0 3px rgba(0,194,168,0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = arrivalTooEarly
                ? "#e74c3c"
                : "#e8edf0";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {arrivalTooEarly && minArrivalTime ? (
            <p
              role="alert"
              style={{
                fontSize: 12,
                color: "#e74c3c",
                margin: "5px 0 0",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              ⚠ Must be after <strong>{to12h(minArrivalTime)}</strong> — when
              the previous trip ends.
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "#5A6A7A", margin: "5px 0 0" }}>
              When do you need to arrive at your destination?
            </p>
          )}
        </div>

        {/* Pickup time — readonly window: arrival − duration − vehicle margin, ±10min */}
        <div>
          <label
            style={{
              ...labelStyle,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Clock size={13} style={{ color: "#00C2A8" }} aria-hidden="true" />
            {isSharedVehicle(data.vehicleType)
              ? "Board station by"
              : "Pickup time"}
            <span
              title={
                isSharedVehicle(data.vehicleType)
                  ? "Time to be at the pickup station. Computed from arrival − walk from dropoff station − ride − buffer."
                  : "Computed from arrival − drive − buffer. You can depart earlier."
              }
              style={{ cursor: "help", color: "#5A6A7A" }}
            >
              <Info size={12} aria-hidden="true" />
            </span>
          </label>
          {data.pickupTime ? (
            <div
              style={readonlyStyle}
              aria-label="Pickup time window"
              role="status"
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0B1E3D",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {/* {to12h(data.pickupTime)} ~ {to12h(pickupWindowEnd)} */}
                {to12h(data.pickupTime)}
              </span>
            </div>
          ) : (
            <div
              style={readonlyStyle}
              aria-label="Computed pickup time"
              role="status"
            >
              <span style={{ fontSize: 14, color: "#9aa5b4" }}>
                {!data.pickup || !data.dropoff
                  ? "Set pickup + dropoff first"
                  : !data.arrivalTime
                    ? "Set arrival time above"
                    : "Calculating…"}
              </span>
            </div>
          )}
          {isSharedVehicle(data.vehicleType) &&
            data.pickupTime &&
            data.walkingMinToStation != null &&
            data.walkingMinToStation > 0 && (
              <p style={{ fontSize: 12, color: "#7A5000", margin: "5px 0 0" }}>
                Leave home by{" "}
                <strong>
                  {to12h(
                    toHHMM(
                      toMinutes(data.pickupTime) - data.walkingMinToStation,
                    ),
                  )}
                </strong>{" "}
                (~{data.walkingMinToStation} min walk to station)
              </p>
            )}
        </div>

        {/* Extra passengers */}
        <div>
          <label style={labelStyle}>Extra passengers</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                const nextPassengers = (data.passengers ?? []).slice(0, -1);
                onChange({
                  ...data,
                  extraPassengers: nextPassengers.length,
                  passengers: nextPassengers,
                });
              }}
              disabled={(data.extraPassengers ?? 0) <= 0}
              aria-label="Decrease passengers"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1.5px solid #e8edf0",
                background: "#f8f9fa",
                cursor:
                  (data.extraPassengers ?? 0) <= 0 ? "not-allowed" : "pointer",
                fontSize: 20,
                color: "#0B1E3D",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              −
            </button>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#0B1E3D",
                minWidth: 24,
                textAlign: "center",
              }}
            >
              {data.extraPassengers ?? 0}
            </span>
            <button
              type="button"
              onClick={() => {
                if (
                  (data.extraPassengers ?? 0) >=
                  maxExtraPassengers(data.vehicleType)
                )
                  return;
                const nextPassengers = [
                  ...(data.passengers ?? []),
                  {
                    id: Math.random().toString(36).slice(2, 9),
                    sameAsMain: true,
                    pickup: null,
                    dropoff: null,
                  },
                ];
                onChange({
                  ...data,
                  extraPassengers: nextPassengers.length,
                  passengers: nextPassengers,
                });
              }}
              disabled={
                (data.extraPassengers ?? 0) >=
                maxExtraPassengers(data.vehicleType)
              }
              aria-label="Increase passengers"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1.5px solid #e8edf0",
                background: "#f8f9fa",
                cursor:
                  (data.extraPassengers ?? 0) >=
                  maxExtraPassengers(data.vehicleType)
                    ? "not-allowed"
                    : "pointer",
                fontSize: 20,
                color: "#0B1E3D",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
            <span style={{ fontSize: 12, color: "#5A6A7A" }}>
              (you + {data.extraPassengers ?? 0} passenger
              {(data.extraPassengers ?? 0) !== 1 ? "s" : ""})
            </span>
          </div>

          {/* Per-passenger pickup/dropoff choice — private vehicles only */}
          {!isSharedVehicle(data.vehicleType) &&
            (data.passengers ?? []).map((p, idx) => (
              <div
                key={p.id}
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  background: "#f8f9fa",
                  borderRadius: 10,
                  border: "1.5px solid #e8edf0",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Passenger {idx + 1}
                </span>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() =>
                      updatePassenger(p.id, {
                        sameAsMain: true,
                        pickup: null,
                        dropoff: null,
                      })
                    }
                    style={pickBtnStyle(p.sameAsMain)}
                  >
                    Same as main
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePassenger(p.id, { sameAsMain: false })}
                    style={pickBtnStyle(!p.sameAsMain)}
                  >
                    Different points
                  </button>
                </div>
                {!p.sameAsMain && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div>
                      <AddressInput
                        id={`pax-${p.id}-pickup`}
                        placeholder="Passenger pickup address"
                        value={p.pickup}
                        onChange={(pt) => updatePassenger(p.id, { pickup: pt })}
                        iconColor="#0B1E3D"
                        savedAddresses={savedAddresses}
                      />
                      {data.pickup && (
                        <button
                          type="button"
                          onClick={() =>
                            updatePassenger(p.id, { pickup: data.pickup })
                          }
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#0B1E3D",
                            padding: 0,
                          }}
                        >
                          Use main pickup location
                        </button>
                      )}
                    </div>
                    <div>
                      <AddressInput
                        id={`pax-${p.id}-dropoff`}
                        placeholder="Passenger dropoff address"
                        value={p.dropoff}
                        onChange={(pt) => updatePassenger(p.id, { dropoff: pt })}
                        iconColor="#00C2A8"
                        savedAddresses={savedAddresses}
                      />
                      {data.dropoff && (
                        <button
                          type="button"
                          onClick={() =>
                            updatePassenger(p.id, { dropoff: data.dropoff })
                          }
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#00897B",
                            padding: 0,
                          }}
                        >
                          Use main dropoff location
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

          {detourExceeded && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: "#e74c3c",
                background: "rgba(231,76,60,0.07)",
                border: "1px solid rgba(231,76,60,0.2)",
                borderRadius: 8,
                padding: "8px 12px",
                marginTop: 10,
              }}
            >
              ⚠ Passenger detour exceeds 25% of the base route — adjust points.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveAddressButton({
  point,
  onSaved,
}: {
  point: TripPoint;
  onSaved: (s: SavedAddress) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: point.address.split(",")[0].trim(),
          address: point.address,
          lat: point.lat,
          lng: point.lng,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        onSaved(d.savedAddress);
        setDone(true);
      }
    } finally {
      setSaving(false);
    }
  }

  if (done)
    return (
      <span
        style={{
          fontSize: 12,
          color: "#00897B",
          marginTop: 4,
          display: "block",
        }}
      >
        ✓ Saved
      </span>
    );
  return (
    <button
      type="button"
      onClick={save}
      disabled={saving}
      style={{
        marginTop: 5,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "inherit",
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#5A6A7A",
        padding: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {saving ? "Saving…" : "＋ Save this location"}
    </button>
  );
}
