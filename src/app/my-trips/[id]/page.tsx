import { redirect, notFound } from "next/navigation";
import {
  Car,
  MapPin,
  Clock,
  Route,
  Users,
  CalendarDays,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getUserTrip } from "@/lib/services/trips";
import { VEHICLES } from "@/lib/config/vehicles";
import type { VehicleKey } from "@/lib/config/vehicles";
import AppHeader from "@/components/layout/AppHeader";
import RouteMap from "@/components/shared/RouteMap";
import type { PaymentStatus, TripStatus } from "@/types/booking";

export const metadata = { title: "Trip detail — Commuter" };
export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const PAY_PILL: Record<
  PaymentStatus,
  { label: string; bg: string; color: string }
> = {
  pending: { label: "Awaiting payment", bg: "#FFF8E1", color: "#E65100" },
  paid: { label: "Paid", bg: "#E8F5E9", color: "#27AE60" },
  failed: { label: "Payment failed", bg: "#FFEBEE", color: "#E74C3C" },
  refunded: { label: "Refunded", bg: "#EDE7F6", color: "#6A1B9A" },
  expired: { label: "Expired", bg: "#F5F5F5", color: "#9aa7b4" },
};

const STATUS_PILL: Record<
  TripStatus,
  { label: string; bg: string; color: string }
> = {
  pending_payment: {
    label: "Pending payment",
    bg: "#FFF3E0",
    color: "#E65100",
  },
  submitted: { label: "Upcoming", bg: "#E2E8F0", color: "#5A6A7A" },
  matching: { label: "Ongoing", bg: "#00C2A8", color: "#fff" },
  confirmed: { label: "Upcoming", bg: "#E2E8F0", color: "#5A6A7A" },
  active: { label: "Ongoing", bg: "#00C2A8", color: "#fff" },
  completed: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
  cancelled: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
  time_out: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
};

function Pill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            color: "#9aa7b4",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 14,
            color: "#0B1E3D",
            fontWeight: 600,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?redirect=/my-trips/${id}`);
  const trip = await getUserTrip(session.userId, id);

  if (!trip) notFound();

  const vLabel =
    VEHICLES[trip.vehicleType as VehicleKey]?.label ?? trip.vehicleType;
  const paymentStatus = (trip.paymentStatus as PaymentStatus) ?? "pending";
  const status = (trip.status as TripStatus) ?? "pending_payment";
  const distinctPassengers = (trip.passengers ?? []).filter(
    (p) => !p.sameAsMain && p.pickup && p.dropoff,
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={session.email}
        variant="app"
        backHref="/my-trips"
      />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 56px" }}
      >
        {/* Summary header */}
        <div style={{ marginBottom: 20 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#5A6A7A",
              marginBottom: 8,
            }}
          >
            <CalendarDays size={14} aria-hidden="true" />
            {prettyDate(trip.date)}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill {...(PAY_PILL[paymentStatus] ?? PAY_PILL.pending)} />
              <Pill {...(STATUS_PILL[status] ?? STATUS_PILL.pending_payment)} />
            </div>
            <span
              style={{
                fontWeight: 900,
                fontSize: 22,
                color: "#0B1E3D",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {trip.priceEgp} EGP
            </span>
          </div>
        </div>

        {/* Route map */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <RouteMap
            pickup={trip.pickup}
            dropoff={trip.dropoff}
            height={220}
            interactive
          />

          <div style={{ padding: "16px 18px" }}>
            {/* Pickup / dropoff */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", gap: 10 }}>
                <MapPin
                  size={15}
                  color="#00C2A8"
                  style={{ marginTop: 2, flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9aa7b4",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Pickup
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 14,
                      color: "#0B1E3D",
                    }}
                  >
                    {trip.pickup?.address ?? "—"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <MapPin
                  size={15}
                  color="#E74C3C"
                  style={{ marginTop: 2, flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9aa7b4",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Dropoff
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 14,
                      color: "#0B1E3D",
                    }}
                  >
                    {trip.dropoff?.address ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                borderTop: "1px solid #f4f6f8",
                paddingTop: 14,
              }}
            >
              <Detail
                icon={<Route size={15} color="#0B1E3D" />}
                label="Ride type"
                value={trip.rideType === "shared" ? "Shared" : "Private"}
              />
              <Detail
                icon={<Car size={15} color="#0B1E3D" />}
                label="Vehicle"
                value={vLabel}
              />
              <Detail
                icon={<Users size={15} color="#0B1E3D" />}
                label="Extra passengers"
                value={String(trip.extraPassengers)}
              />
              <Detail
                icon={<Clock size={15} color="#0B1E3D" />}
                label="Pickup time"
                value={to12h(trip.pickupTime)}
              />
              <Detail
                icon={<Clock size={15} color="#0B1E3D" />}
                label="Arrival time"
                value={to12h(trip.arrivalTime)}
              />
              <Detail
                icon={<Route size={15} color="#0B1E3D" />}
                label="Distance"
                value={`${trip.distanceKm.toFixed(1)} km`}
              />
              <Detail
                icon={<Clock size={15} color="#0B1E3D" />}
                label="Drive time"
                value={`${trip.durationMinutes} min`}
              />
              {trip.rideType === "shared" && trip.pickupStation && (
                <Detail
                  icon={<MapPin size={15} color="#00C2A8" />}
                  label="Pickup station"
                  value={`${trip.pickupStation.name} · ${trip.walkingMinToStation ?? 0} min walk`}
                />
              )}
              {trip.rideType === "shared" && trip.dropoffStation && (
                <Detail
                  icon={<MapPin size={15} color="#E74C3C" />}
                  label="Dropoff station"
                  value={`${trip.dropoffStation.name} · ${trip.walkingMinFromStation ?? 0} min walk`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Distinct passenger points (private rides) */}
        {distinctPassengers.length > 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #eef0f3",
              padding: "16px 18px",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                fontWeight: 700,
                color: "#0B1E3D",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Passenger stops
            </p>
            {distinctPassengers.map((p, i) => (
              <div
                key={i}
                style={{
                  borderTop: i > 0 ? "1px solid #f4f6f8" : undefined,
                  paddingTop: i > 0 ? 12 : 0,
                  marginTop: i > 0 ? 12 : 0,
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#5A6A7A",
                  }}
                >
                  Passenger {i + 1}
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <MapPin
                      size={12}
                      color="#00C2A8"
                      style={{ marginTop: 2, flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                      {p.pickup?.address ?? "—"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <MapPin
                      size={12}
                      color="#E74C3C"
                      style={{ marginTop: 2, flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                      {p.dropoff?.address ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p
          style={{
            fontSize: 12,
            color: "#9aa7b4",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          Requested {new Date(trip.createdAt).toLocaleString("en-EG")}
        </p>
      </main>
    </div>
  );
}
