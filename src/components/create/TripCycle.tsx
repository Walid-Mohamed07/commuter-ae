"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, X, Clock, MapPin, Navigation, Info } from "lucide-react";
import AddressInput from "@/components/landing/AddressInput";
import {
  VEHICLE_LIST,
  priceFor,
  maxExtraPassengers,
  finalPrice,
  type VehicleKey,
} from "@/lib/config/vehicles";
import { computePickupTime, toHHMM, toMinutes } from "@/lib/time/pickupWindow";
import { fetchRoute } from "@/lib/openrouteservice";
import type { TripPoint } from "@/lib/store/useTripStore";

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
}

interface Props {
  data: TripData;
  index: number;
  canRemove: boolean;
  onChange: (updated: TripData) => void;
  onRemove: () => void;
  picking?: "pickup" | "dropoff" | null;
  onPickFromMap?: (field: "pickup" | "dropoff") => void;
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
}: Props) {
  const [routeLoading, setRouteLoading] = useState(false);

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
      });
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    fetchRoute([data.pickup, data.dropoff])
      .then((routes) => {
        if (cancelled || !routes.length) return;
        const { distance_km, duration_minutes, coordinates } = routes[0];
        const price = priceFor(distance_km, data.vehicleType);
        const pt = data.arrivalTime
          ? computePickupTime(
              data.arrivalTime,
              duration_minutes,
              data.vehicleType,
            )
          : "";
        onChange({
          ...data,
          distanceKm: distance_km,
          durationMinutes: duration_minutes,
          priceEgp: price,
          pickupTime: pt,
          routeCoordinates: coordinates,
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
  }, [JSON.stringify(data.pickup), JSON.stringify(data.dropoff)]);

  /* ── Recompute pickup time when arrival or vehicle changes ── */
  useEffect(() => {
    if (!data.arrivalTime || !data.durationMinutes) return;
    const pt = computePickupTime(
      data.arrivalTime,
      data.durationMinutes,
      data.vehicleType,
    );
    if (pt !== data.pickupTime) onChange({ ...data, pickupTime: pt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.arrivalTime, data.vehicleType, data.durationMinutes]);

  /* ── Recompute price when vehicle changes ── */
  useEffect(() => {
    if (!data.distanceKm) return;
    const price = priceFor(data.distanceKm, data.vehicleType);
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

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        border: "1.5px solid #eef0f3",
        overflow: "hidden",
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
          background: "#fafbfc",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: "#0B1E3D" }}>
          Trip {index + 1}
        </span>
        {data.priceEgp && (
          <span
            className="price-pop"
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: "#00C2A8",
              fontVariantNumeric: "tabular-nums",
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
          />
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
          />
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
              const newPickupTime =
                data.arrivalTime && data.durationMinutes
                  ? computePickupTime(
                      data.arrivalTime,
                      data.durationMinutes,
                      newVehicle,
                    )
                  : data.pickupTime;
              onChange({
                ...data,
                vehicleType: newVehicle,
                extraPassengers: clampedPassengers,
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
            {VEHICLE_LIST.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

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
            onChange={(e) => set("arrivalTime", e.target.value)}
            required
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
              boxSizing: "border-box",
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
          />
          <p style={{ fontSize: 12, color: "#5A6A7A", margin: "5px 0 0" }}>
            When do you need to arrive at your destination?
          </p>
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
            Pickup time
            <span
              title="Computed from arrival − drive − buffer. You can depart earlier."
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
                {to12h(data.pickupTime)} ~ {to12h(pickupWindowEnd)}
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
        </div>

        {/* Extra passengers */}
        <div>
          <label style={labelStyle}>Extra passengers</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() =>
                set(
                  "extraPassengers",
                  Math.max(0, (data.extraPassengers ?? 0) - 1),
                )
              }
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
              onClick={() =>
                set(
                  "extraPassengers",
                  Math.min(
                    maxExtraPassengers(data.vehicleType),
                    (data.extraPassengers ?? 0) + 1,
                  ),
                )
              }
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
        </div>
      </div>
    </div>
  );
}
