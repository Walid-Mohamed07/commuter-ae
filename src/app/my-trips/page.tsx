import { redirect } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import { Car, MapPin, Clock, CalendarDays, ChevronRight } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { VEHICLES } from "@/lib/config/vehicles";
import type { VehicleKey } from "@/lib/config/vehicles";
import AppHeader from "@/components/layout/AppHeader";
import EmptyState from "@/components/shared/EmptyState";
import FilterBar, { type FilterDef } from "@/components/shared/FilterBar";
import Pagination from "@/components/shared/Pagination";
import RouteMap from "@/components/shared/RouteMap";

export const metadata = { title: "My trips — Commuter" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

// ── helpers ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function truncate(s: string, max = 38): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-EG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "expired";

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

const PAYMENT_OPTIONS: FilterDef = {
  key: "payment",
  label: "Payment",
  options: [
    { value: "paid", label: "Paid" },
    { value: "pending", label: "Awaiting payment" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
  ],
};

const VEHICLE_OPTIONS: FilterDef = {
  key: "vehicle",
  label: "Vehicle",
  options: (Object.keys(VEHICLES) as VehicleKey[]).map((k) => ({
    value: k,
    label: VEHICLES[k].label,
  })),
};

const STATUS_OPTIONS: FilterDef = {
  key: "status",
  label: "Status",
  options: [
    { value: "pending_payment", label: "Pending payment" },
    { value: "submitted", label: "Submitted" },
    { value: "matching", label: "Matching" },
    { value: "confirmed", label: "Confirmed" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "time_out", label: "Timed out" },
  ],
};

// ── shape ────────────────────────────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

interface TripRow {
  id: string;
  date: string;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  pickupTime: string;
  arrivalTime: string;
  priceEgp: number;
  createdAt: string;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-trips");

  if (session.role !== "driver") redirect("/activity");

  if (session.role === "driver") {
    return (
      <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
        <AppHeader
          authed
          email={session.email}
          role="driver"
          variant="app"
          backHref="/"
        />
        <main
          style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
        >
          <div style={{ marginBottom: 22 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0B1E3D",
                margin: "0 0 4px",
                letterSpacing: "-0.02em",
              }}
            >
              My trips
            </h1>
            <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
              Trips assigned to you will appear here.
            </p>
          </div>
          <EmptyState
            icon="🚗"
            title="No assigned trips yet"
            description="Once a trip is assigned to you, it will show up here."
          />
        </main>
      </div>
    );
  }

  const params = await searchParams;
  const payment =
    typeof params.payment === "string" ? params.payment : undefined;
  const vehicle =
    typeof params.vehicle === "string" ? params.vehicle : undefined;
  const statusFilter =
    typeof params.status === "string" ? params.status : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  await connectDB();

  const tripMatch: Record<string, unknown> = {
    userId: new Types.ObjectId(session.userId),
  };
  if (payment && payment in PAY_PILL) tripMatch.paymentStatus = payment;
  if (vehicle && vehicle in VEHICLES) tripMatch.vehicleType = vehicle;

  const [total, rawTrips] = await Promise.all([
    Trip.countDocuments(tripMatch),
    Trip.find(tripMatch)
      .sort({ date: -1, cycleIndex: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean<
        {
          _id: unknown;
          date: string;
          paymentStatus: string;
          vehicleType: string;
          pickup: { address: string; lat: number; lng: number };
          dropoff: { address: string; lat: number; lng: number };
          pickupTime: string;
          arrivalTime: string;
          priceEgp: number;
          createdAt: Date | string;
        }[]
      >(),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const trips: TripRow[] = rawTrips.map((r) => ({
    id: String(r._id),
    date: r.date,
    paymentStatus: (r.paymentStatus as PaymentStatus) ?? "pending",
    vehicleType: r.vehicleType,
    pickupAddress: r.pickup?.address ?? "—",
    dropoffAddress: r.dropoff?.address ?? "—",
    pickup:
      typeof r.pickup?.lat === "number"
        ? { lat: r.pickup.lat, lng: r.pickup.lng }
        : null,
    dropoff:
      typeof r.dropoff?.lat === "number"
        ? { lat: r.dropoff.lat, lng: r.dropoff.lng }
        : null,
    pickupTime: r.pickupTime,
    arrivalTime: r.arrivalTime,
    priceEgp: r.priceEgp,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt),
  }));

  const hasFilters = Boolean(payment || vehicle || statusFilter);

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={session.email} variant="app" backHref="/" />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
      >
        <div style={{ marginBottom: 22 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#0B1E3D",
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            My trips
          </h1>
          <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
            {total === 0
              ? hasFilters
                ? "No trips match these filters."
                : "No trips yet."
              : `${total} trip${total === 1 ? "" : "s"} in your history`}
          </p>
        </div>

        <FilterBar filters={[PAYMENT_OPTIONS, VEHICLE_OPTIONS, STATUS_OPTIONS]} />

        {trips.length === 0 ? (
          <EmptyState
            icon="🧾"
            title={hasFilters ? "Nothing here" : "No trips yet"}
            description={
              hasFilters
                ? "Try clearing the filters to see your full history."
                : "Every trip from your requests will be logged here."
            }
            action={
              <Link
                href="/create"
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: "#0B1E3D",
                  color: "#fff",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Book a ride
              </Link>
            }
          />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {trips.map((trip) => {
                const vLabel =
                  VEHICLES[trip.vehicleType as VehicleKey]?.label ??
                  trip.vehicleType;
                const timedOut = trip.status === "time_out";
                return (
                  <Link
                    key={trip.id}
                    href={`/my-trips/${trip.id}`}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      border: "1px solid #eef0f3",
                      overflow: "hidden",
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                      opacity: timedOut ? 0.55 : 1,
                    }}
                  >
                    <RouteMap
                      pickup={trip.pickup}
                      dropoff={trip.dropoff}
                      height={130}
                    />
                    <div style={{ padding: "14px 18px" }}>
                      {/* Top row: date + payment status + price */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#5A6A7A",
                            }}
                          >
                            <CalendarDays
                              size={13}
                              color="#5A6A7A"
                              aria-hidden="true"
                            />
                            {prettyDate(trip.date)}
                          </span>
                          <Pill
                            {...(PAY_PILL[trip.paymentStatus] ??
                              PAY_PILL.pending)}
                          />
                          <Pill
                            {...(STATUS_PILL[trip.status] ??
                              STATUS_PILL.pending_payment)}
                          />
                        </div>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 15,
                            color: "#00C2A8",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {trip.priceEgp} EGP
                        </span>
                      </div>

                      {/* Vehicle */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        <Car size={14} color="#0B1E3D" aria-hidden="true" />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#0B1E3D",
                          }}
                        >
                          {vLabel}
                        </span>
                      </div>

                      {/* Pickup → Dropoff */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                          }}
                        >
                          <MapPin
                            size={13}
                            color="#00C2A8"
                            style={{ marginTop: 2, flexShrink: 0 }}
                            aria-hidden="true"
                          />
                          <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                            {truncate(trip.pickupAddress)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                          }}
                        >
                          <MapPin
                            size={13}
                            color="#E74C3C"
                            style={{ marginTop: 2, flexShrink: 0 }}
                            aria-hidden="true"
                          />
                          <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                            {truncate(trip.dropoffAddress)}
                          </span>
                        </div>
                      </div>

                      {/* Times */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                          marginTop: 10,
                        }}
                      >
                        <div style={{ display: "flex", gap: 16 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Clock
                              size={12}
                              color="#5A6A7A"
                              aria-hidden="true"
                            />
                            <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                              Pickup{" "}
                              <strong style={{ color: "#0B1E3D" }}>
                                {to12h(trip.pickupTime)}
                              </strong>
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Clock
                              size={12}
                              color="#5A6A7A"
                              aria-hidden="true"
                            />
                            <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                              Arrive{" "}
                              <strong style={{ color: "#0B1E3D" }}>
                                {to12h(trip.arrivalTime)}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          size={18}
                          color="#9aa7b4"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <Pagination page={page} totalPages={totalPages} />
          </>
        )}
      </main>
    </div>
  );
}
