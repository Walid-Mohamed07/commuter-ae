"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Eye, Car, MapPin, Flag, Clock, Route } from "lucide-react";
import { useTripStore } from "@/lib/store/useTripStore";
import type { TripPoint } from "@/lib/store/useTripStore";
import AppHeader from "@/components/layout/AppHeader";
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
    extraPassengers: 0,
  };
}

export default function CreateClient({ userEmail }: Props) {
  const { pickup, dropoff } = useTripStore();
  const [mounted, setMounted] = useState(false);
  const date = format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd");
  const [trips, setTrips] = useState<TripData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [picking, setPicking] = useState<{
    tripId: string;
    field: "pickup" | "dropoff";
  } | null>(null);

  // Hydrate from store after mount (avoid SSR mismatch)
  useEffect(() => {
    setMounted(true);
    setTrips([defaultTrip(pickup, dropoff)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load wallet balance so we can offer it as a payment method.
  // Reconcile first so any top-up Kashier confirmed but we missed is credited
  // before the balance is shown.
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/wallet/reconcile", { method: "POST" });
      } catch {
        /* non-fatal */
      }
      try {
        const r = await fetch("/api/wallet", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          setWalletBalance(d.balanceEgp);
        }
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const handleMapPick = useCallback(
    (point: TripPoint) => {
      if (!picking) return;
      setTrips((prev) =>
        prev.map((t) =>
          t.id === picking.tripId ? { ...t, [picking.field]: point } : t,
        ),
      );
      setPicking(null);
    },
    [picking],
  );

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    let navigating = false;
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
            extraPassengers: t.extraPassengers,
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

      // ── Wallet payment ──
      if (payMethod === "wallet") {
        const walletRes = await fetch("/api/payments/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: data.bookingId }),
        });
        const walletData = await walletRes.json();
        if (!walletRes.ok) {
          setSubmitError(
            walletData.error ?? "Wallet payment failed. Please try again.",
          );
          return;
        }
        navigating = true;
        window.location.href = `/checkout/callback?bookingId=${data.bookingId}`;
        return;
      }

      // ── Card payment (Kashier) ──
      const payRes = await fetch("/api/payments/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: data.bookingId }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) {
        setSubmitError(
          payData.error ?? "Failed to initiate payment. Please try again.",
        );
        return;
      }
      navigating = true;
      // Full redirect (not router.push) so the browser leaves the SPA entirely
      window.location.href = payData.sessionUrl;
    } catch {
      setSubmitError("Network error. Please check your connection and retry.");
    } finally {
      if (!navigating) setSubmitting(false);
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

  const totalEgp = trips.reduce(
    (sum, t) =>
      sum + finalPrice(t.priceEgp ?? 0, t.extraPassengers ?? 0, t.vehicleType),
    0,
  );

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
      <AppHeader authed email={userEmail} variant="app" />

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
                  picking={picking?.tripId === trip.id ? picking.field : null}
                  onPickFromMap={(field) =>
                    setPicking({ tripId: trip.id, field })
                  }
                />
              ))}
            </div>

            {/* Add trip */}
            {trips.length < 3 && (
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
          <CreateMap
            trips={trips}
            picking={picking}
            onMapPick={handleMapPick}
          />
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
                      {finalPrice(
                        t.priceEgp ?? 0,
                        t.extraPassengers ?? 0,
                        t.vehicleType,
                      )}{" "}
                      EGP
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#5A6A7A",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Car
                        size={15}
                        color="#0B1E3D"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      />
                      <strong style={{ color: "#0B1E3D", fontWeight: 600 }}>
                        {VEHICLE_LIST_LABEL(t.vehicleType)}
                      </strong>
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <MapPin
                        size={15}
                        color="#00C2A8"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      />
                      {t.pickup?.address
                        ? formatDisplayName(t.pickup.address)
                        : "—"}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Flag
                        size={15}
                        color="#F5A623"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      />
                      {t.dropoff?.address
                        ? formatDisplayName(t.dropoff.address)
                        : "—"}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Clock
                        size={15}
                        color="#5A6A7A"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      />
                      <span>
                        Pickup: <strong>{to12h(t.pickupTime)}</strong> · Arrive:{" "}
                        <strong>{to12h(t.arrivalTime)}</strong>
                      </span>
                    </span>
                    {t.distanceKm && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Route
                          size={15}
                          color="#5A6A7A"
                          aria-hidden="true"
                          style={{ flexShrink: 0 }}
                        />
                        {t.distanceKm} km · {t.durationMinutes} min drive
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

              {/* ── Instructions & guidance ── */}
              {(() => {
                const vehicleTypes = trips.map((t) => t.vehicleType);
                const hasNoWait = vehicleTypes.some(
                  (v) => v === "van_shared" || v === "microbus_shared",
                );
                const has5min = vehicleTypes.some(
                  (v) => v === "private_car" || v === "taxi_private",
                );
                const has3min = vehicleTypes.some((v) => v === "taxi_shared");
                return (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "14px 16px",
                      background: "rgba(245,166,35,0.1)",
                      border: "1.5px solid #F5A623",
                      borderRadius: 12,
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontWeight: 800,
                        fontSize: 13,
                        color: "#0B1E3D",
                        marginBottom: 8,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      ⚠️ Instructions &amp; guidance
                    </span>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      <li
                        style={{
                          fontSize: 13,
                          color: "#0B1E3D",
                          fontWeight: 600,
                        }}
                      >
                        Please be punctual — drivers will not wait beyond the
                        allowed time.
                      </li>
                      {hasNoWait && (
                        <li
                          style={{
                            fontSize: 13,
                            color: "#e74c3c",
                            fontWeight: 700,
                          }}
                        >
                          No waiting time allowed for Van / Microbus rides — be
                          at the pickup point on time.
                        </li>
                      )}
                      {has3min && (
                        <li
                          style={{
                            fontSize: 13,
                            color: "#0B1E3D",
                            fontWeight: 600,
                          }}
                        >
                          Shared Taxi: maximum waiting time is{" "}
                          <strong>3 minutes</strong>.
                        </li>
                      )}
                      {has5min && (
                        <>
                          <li
                            style={{
                              fontSize: 13,
                              color: "#0B1E3D",
                              fontWeight: 600,
                            }}
                          >
                            Private Car / Private Taxi: Maximum waiting time is{" "}
                            <strong>5 minutes</strong>.
                          </li>
                          <li
                            style={{
                              fontSize: 13,
                              color: "#0B1E3D",
                              fontWeight: 600,
                            }}
                          >
                            Private Car / Private Taxi: Maximum baggage load is{" "}
                            <strong>2 pieces</strong>.
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                );
              })()}

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

              {/* Payment method */}
              {(() => {
                const walletEnough =
                  walletBalance !== null && walletBalance >= totalEgp;
                return (
                  <div style={{ marginTop: 18 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0B1E3D",
                        display: "block",
                        marginBottom: 10,
                      }}
                    >
                      Payment method
                    </span>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setPayMethod("card")}
                        style={{
                          flex: 1,
                          padding: "12px 14px",
                          borderRadius: 12,
                          border:
                            payMethod === "card"
                              ? "1.5px solid #00C2A8"
                              : "1.5px solid #eef0f3",
                          background:
                            payMethod === "card"
                              ? "rgba(0,194,168,0.08)"
                              : "#fff",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0B1E3D",
                          }}
                        >
                          Card
                        </span>
                        <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                          Pay via Kashier
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => walletEnough && setPayMethod("wallet")}
                        disabled={!walletEnough}
                        style={{
                          flex: 1,
                          padding: "12px 14px",
                          borderRadius: 12,
                          border:
                            payMethod === "wallet"
                              ? "1.5px solid #00C2A8"
                              : "1.5px solid #eef0f3",
                          background:
                            payMethod === "wallet"
                              ? "rgba(0,194,168,0.08)"
                              : "#fff",
                          cursor: walletEnough ? "pointer" : "not-allowed",
                          opacity: walletEnough ? 1 : 0.55,
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0B1E3D",
                          }}
                        >
                          Wallet
                        </span>
                        <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                          {walletBalance === null
                            ? "Loading balance…"
                            : `Balance: ${walletBalance} EGP`}
                        </span>
                      </button>
                    </div>
                    {walletBalance !== null && !walletEnough && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "#5A6A7A",
                          margin: "8px 0 0",
                        }}
                      >
                        Not enough balance to pay {totalEgp} EGP.{" "}
                        <Link
                          href="/wallet"
                          style={{ color: "#00C2A8", fontWeight: 600 }}
                        >
                          Top up your wallet
                        </Link>
                      </p>
                    )}
                  </div>
                );
              })()}

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
          .create-layout { flex-direction: column !important; overflow-y: auto !important; overflow-x: hidden !important; }
          .create-left { 
            width: 100% !important; 
            margin: 0 !important; 
            border: none !important; 
            border-radius: 0 !important; 
            border-bottom: 1px solid #eef0f3 !important; 
            overflow-y: visible !important; 
            flex-shrink: 0 !important;
          }
          .create-right { flex: 1 1 100% !important; margin: 20px !important; border-radius: 20px !important; height: 320px !important; flex-shrink: 0 !important; }
          .email-desktop { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Helpers local to this file ── */
import { VEHICLE_LIST, finalPrice } from "@/lib/config/vehicles";
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
