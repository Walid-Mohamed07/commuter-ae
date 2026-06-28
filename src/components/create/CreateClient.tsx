"use client";
import { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Eye, LogOut } from "lucide-react";
import { useTripStore } from "@/lib/store/useTripStore";
import type { TripPoint } from "@/lib/store/useTripStore";
import DatePicker from "./DatePicker";
import TripCycle, { type TripData } from "./TripCycle";
import { format, addDays, startOfDay } from "date-fns";
import CreateMap from "./CreateMap";

interface Props {
  userEmail: string;
}

function makeTripId() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultTrip(
  pickup: TripPoint | null,
  dropoff: TripPoint | null,
): TripData {
  return {
    id: makeTripId(),
    pickup,
    dropoff,
    vehicleType: "private_car",
    arrivalTime: "",
    pickupTime: "",
    distanceKm: null,
    durationMinutes: null,
    priceEgp: null,
    routeCoordinates: null,
  };
}

export default function CreateClient({ userEmail }: Props) {
  const router = useRouter();
  const { pickup, dropoff, clear } = useTripStore();
  const [mounted, setMounted] = useState(false);
  const date = format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd");
  const [trips, setTrips] = useState<TripData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Hydrate from store after mount (avoid SSR mismatch)
  useEffect(() => {
    setMounted(true);
    setTrips([defaultTrip(pickup, dropoff)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          trips: trips.map((t) => ({
            pickup: t.pickup,
            dropoff: t.dropoff,
            vehicleType: t.vehicleType,
            arrivalTime: t.arrivalTime,
            distanceKm: t.distanceKm,
            durationMinutes: t.durationMinutes,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(
          data.error ?? "Failed to create booking. Please try again.",
        );
        return;
      }
      // Phase 6 will create the Kashier session here; for now redirect to callback
      router.push(`/checkout/callback?bookingId=${data.bookingId}`);
    } catch {
      setSubmitError("Network error. Please check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  const updateTrip = useCallback((id: string, updated: TripData) => {
    setTrips((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const removeTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  function addTrip() {
    setTrips((prev) => [...prev, defaultTrip(null, null)]);
  }

  // Validate all trips before preview
  function validate(): string | null {
    for (let i = 0; i < trips.length; i++) {
      const t = trips[i];
      if (!t.pickup) return `Trip ${i + 1}: pickup location required.`;
      if (!t.dropoff) return `Trip ${i + 1}: dropoff location required.`;
      if (!t.arrivalTime) return `Trip ${i + 1}: arrival time required.`;
      if (!t.pickupTime)
        return `Trip ${i + 1}: pickup time not yet computed — wait a moment.`;
    }
    return null;
  }

  const [validationError, setValidationError] = useState("");

  function handlePreview() {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError("");
    setShowPreview(true);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      clear();
    } finally {
      router.replace("/login");
    }
  }

  const totalEgp = trips.reduce((sum, t) => sum + (t.priceEgp ?? 0), 0);

  if (!mounted) {
    return (
      <div
        style={{
          height: "100dvh",
          overflow: "hidden",
          background: "#f8f9fa",
          display: "flex",
          flexDirection: "column",
          // alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#5A6A7A", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#f8f9fa",
      }}
    >
      {/* Top nav bar */}
      <header
        style={{
          height: 56,
          background: "#ffffff",
          borderBottom: "1px solid #eef0f3",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontWeight: 900,
              fontSize: 17,
              color: "#0B1E3D",
              letterSpacing: "-0.025em",
            }}
          >
            Commuter<span style={{ color: "#00C2A8" }}>AE</span>
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{ fontSize: 13, color: "#5A6A7A", display: "none" }}
            className="email-desktop"
          >
            {userEmail}
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "1.5px solid #e8edf0",
              borderRadius: 8,
              cursor: "pointer",
              color: "#5A6A7A",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              padding: "8px 14px",
              minHeight: 36,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#e74c3c";
              e.currentTarget.style.color = "#e74c3c";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e8edf0";
              e.currentTarget.style.color = "#5A6A7A";
            }}
          >
            <LogOut size={14} aria-hidden="true" />
            Log out
          </button>
        </div>
      </header>

      {/* Main split layout */}
      <div
        style={{ flex: 1, display: "flex", overflow: "hidden" }}
        className="create-layout"
      >
        {/* ── Left: form panel ── */}
        <aside
          style={{
            width: 520,
            flexShrink: 0,
            background: "#ffffff",
            borderRight: "1px solid #eef0f3",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            margin: "40px 0 40px 40px",
            border: "1px solid #ccc",
            borderRadius: 15,
          }}
          className="create-left"
        >
          <div
            style={{
              padding: "32px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  margin: "0 0 4px",
                  letterSpacing: "-0.02em",
                }}
              >
                Book a ride
              </h1>
              <p style={{ fontSize: 13, color: "#5A6A7A", margin: 0 }}>
                Fill in the details for each trip on your chosen date.
              </p>
            </div>

            <DatePicker value={date} />

            {/* Trip cycles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {trips.map((trip, i) => (
                <TripCycle
                  key={trip.id}
                  data={trip}
                  index={i}
                  canRemove={trips.length > 1}
                  onChange={(updated) => updateTrip(trip.id, updated)}
                  onRemove={() => removeTrip(trip.id)}
                />
              ))}
            </div>

            {/* Add trip */}
            {trips.length < 5 && (
              <button
                type="button"
                onClick={addTrip}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  height: 48,
                  background: "transparent",
                  border: "2px dashed #d0d8e0",
                  borderRadius: 12,
                  cursor: "pointer",
                  color: "#5A6A7A",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00C2A8";
                  e.currentTarget.style.color = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#d0d8e0";
                  e.currentTarget.style.color = "#5A6A7A";
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Add another trip
              </button>
            )}

            {/* Validation error */}
            {validationError && (
              <p
                role="alert"
                aria-live="assertive"
                style={{
                  fontSize: 13,
                  color: "#e74c3c",
                  background: "rgba(231,76,60,0.07)",
                  border: "1px solid rgba(231,76,60,0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  margin: 0,
                }}
              >
                {validationError}
              </p>
            )}

            {/* Preview CTA */}
            <div
              style={{
                position: "sticky",
                bottom: 0,
                background: "#ffffff",
                paddingTop: 12,
                paddingBottom: 8,
                marginTop: -4,
              }}
            >
              {totalEgp > 0 && (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 13,
                    color: "#5A6A7A",
                    margin: "0 0 10px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  Estimated total:{" "}
                  <strong style={{ color: "#0B1E3D" }}>{totalEgp} EGP</strong>
                </p>
              )}
              <button
                type="button"
                onClick={handlePreview}
                style={{
                  width: "100%",
                  height: 52,
                  background: "#0B1E3D",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#0B1E3D";
                }}
              >
                <Eye size={17} aria-hidden="true" />
                Preview booking
              </button>
            </div>
          </div>
        </aside>

        {/* ── Right: map placeholder (Phase 4 will fill this) ── */}
        <main
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            margin: 40,
            borderRadius: 15,
          }}
          aria-label="Map area"
          className="create-right"
        >
          <CreateMap trips={trips} />
        </main>
      </div>

      {/* ── Preview modal ── */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Booking preview"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(11,30,61,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 0 0 0",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPreview(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 520,
              maxHeight: "85dvh",
              overflowY: "auto",
              padding: "0 0 24px",
            }}
          >
            {/* Handle */}
            <div
              style={{
                padding: "16px 24px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  margin: 0,
                }}
              >
                Booking summary
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                aria-label="Close preview"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#5A6A7A",
                  padding: 4,
                  minWidth: 36,
                  minHeight: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "8px 24px 0" }}>
              <p style={{ fontSize: 13, color: "#5A6A7A", margin: "0 0 16px" }}>
                Date: <strong style={{ color: "#0B1E3D" }}>{date}</strong>
              </p>

              {trips.map((t, i) => (
                <div
                  key={t.id}
                  style={{
                    padding: "14px 16px",
                    background: "#f8f9fa",
                    borderRadius: 12,
                    marginBottom: 10,
                    border: "1px solid #eef0f3",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#0B1E3D",
                      }}
                    >
                      Trip {i + 1}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 15,
                        color: "#00C2A8",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {t.priceEgp} EGP
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#5A6A7A",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <span>🚗 {VEHICLE_LIST_LABEL(t.vehicleType)}</span>
                    <span>
                      📍{" "}
                      {t.pickup?.address
                        ? formatDisplayName(t.pickup.address)
                        : "—"}
                    </span>
                    <span>
                      🏁{" "}
                      {t.dropoff?.address
                        ? formatDisplayName(t.dropoff.address)
                        : "—"}
                    </span>
                    <span>
                      ⏰ Pickup: <strong>{to12h(t.pickupTime)}</strong> ·
                      Arrive: <strong>{to12h(t.arrivalTime)}</strong>
                    </span>
                    {t.distanceKm && (
                      <span>
                        📏 {t.distanceKm} km · {t.durationMinutes} min drive
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {totalEgp > 0 && (
                <div
                  style={{
                    padding: "12px 0",
                    borderTop: "1.5px solid #eef0f3",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 15, color: "#0B1E3D" }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 18,
                      color: "#0B1E3D",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {totalEgp} EGP
                  </span>
                </div>
              )}

              {submitError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  style={{
                    fontSize: 13,
                    color: "#e74c3c",
                    background: "rgba(231,76,60,0.07)",
                    border: "1px solid rgba(231,76,60,0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 12,
                    marginBottom: 0,
                  }}
                >
                  {submitError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  marginTop: 16,
                  width: "100%",
                  height: 52,
                  background: submitting ? "#5A6A7A" : "#0B1E3D",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 12,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!submitting) e.currentTarget.style.background = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  if (!submitting) e.currentTarget.style.background = "#0B1E3D";
                }}
              >
                {submitting ? (
                  <>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.7s linear infinite",
                      }}
                      aria-hidden="true"
                    />
                    Processing…
                  </>
                ) : (
                  "Confirm & pay →"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .email-desktop { display: block; }
        @media (max-width: 767px) {
          .create-layout { flex-direction: column !important; overflow: visible !important; }
          .create-left { width: 100% !important; border-right: none !important; border-bottom: 1px solid #eef0f3 !important; overflow-y: visible !important; }
          .create-right { display: none !important; }
          .email-desktop { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Helpers local to this file ── */
import { VEHICLE_LIST } from "@/lib/config/vehicles";
import { formatDisplayName } from "@/lib/nominatim";

function VEHICLE_LIST_LABEL(key: string) {
  return VEHICLE_LIST.find((v) => v.key === key)?.label ?? key;
}

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}
