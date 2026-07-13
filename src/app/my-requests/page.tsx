import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, Car, ChevronRight, CalendarClock } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import AppHeader from "@/components/layout/AppHeader";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { VEHICLES } from "@/lib/config/vehicles";
import EmptyState from "@/components/shared/EmptyState";
import FilterBar, { type FilterDef } from "@/components/shared/FilterBar";
import Pagination from "@/components/shared/Pagination";
import ContinueCheckoutButton from "@/components/shared/ContinueCheckoutButton";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import type { VehicleKey } from "@/lib/config/vehicles";

export const metadata = { title: "My requests — Commuter" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 8;

// ── helpers ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function truncate(s: string, max = 34): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "expired";
type BookingStatus =
  | "pending_payment"
  | "submitted"
  | "matching"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "time_out";

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
  BookingStatus,
  { label: string; bg: string; color: string }
> = {
  pending_payment: {
    label: "Pending payment",
    bg: "#FFF3E0",
    color: "#E65100",
  },
  submitted: { label: "Submitted", bg: "#E2E8F0", color: "#5A6A7A" },
  matching: { label: "Matching…", bg: "#FFF3E0", color: "#E65100" },
  confirmed: { label: "Confirmed", bg: "#E8F5E9", color: "#27AE60" },
  active: { label: "Active", bg: "#00C2A8", color: "#fff" },
  completed: { label: "Completed", bg: "#0B1E3D", color: "#fff" },
  cancelled: { label: "Cancelled", bg: "#FFEBEE", color: "#E74C3C" },
  time_out: { label: "Timed out", bg: "#F5F5F5", color: "#9aa7b4" },
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

// ── serialisable shape ────────────────────────────────────────────────────────

interface TripRow {
  vehicleType: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  pickupTime: string;
  arrivalTime: string;
  priceEgp: number;
}

interface BookingRow {
  id: string;
  dates: string[];
  trips: TripRow[];
  amountEgp: number;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  createdAt: string;
}

// ── page ─────────────────────────────────────────────────────────────────────

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

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-requests");

  const params = await searchParams;
  const payment =
    typeof params.payment === "string" ? params.payment : undefined;
  const statusFilter =
    typeof params.status === "string" ? params.status : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  await connectDB();

  // Lazy-expire requests older than 2 h that are still pending_payment
  const _expireFilter = {
    userId: session.userId,
    status: "pending_payment",
    paymentStatus: { $in: ["pending", "failed"] },
    $expr: {
      $lte: ["$createdAt", { $subtract: ["$$NOW", 2 * 60 * 60 * 1000] }],
    },
  };
  await Request.updateMany(_expireFilter, {
    $set: { status: "time_out", paymentStatus: "expired" },
  });
  await Trip.updateMany(
    {
      userId: session.userId,
      status: "pending_payment",
      paymentStatus: { $in: ["pending", "failed"] },
      $expr: {
        $lte: ["$createdAt", { $subtract: ["$$NOW", 2 * 60 * 60 * 1000] }],
      },
    },
    { $set: { status: "time_out", paymentStatus: "expired" } },
  );

  const wallet = await getOrCreateWallet(session.userId);
  const walletBalance: number = wallet.balanceEgp ?? 0;

  const query: Record<string, unknown> = { userId: session.userId };
  if (payment && payment in PAY_PILL) query.paymentStatus = payment;
  if (statusFilter && statusFilter in STATUS_PILL) query.status = statusFilter;

  const total = await Request.countDocuments(query);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const raw = await Request.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const hasFilters = Boolean(payment || statusFilter);

  // Fetch cycle-template trips (first date only) for compact list cards.
  const rawList = raw as Record<string, unknown>[];
  const reqIds = rawList.map((b) => b._id);
  const firstDateByReq = new Map<string, string>(
    rawList.map((b) => [String(b._id), ((b.dates as string[]) ?? [])[0] ?? ""]),
  );
  const tripDocs = await Trip.find({ requestId: { $in: reqIds } })
    .sort({ date: 1, cycleIndex: 1 })
    .lean<
      {
        requestId: unknown;
        date: string;
        cycleIndex: number;
        vehicleType: string;
        pickup: { address: string; lat: number; lng: number };
        dropoff: { address: string; lat: number; lng: number };
        pickupTime: string;
        arrivalTime: string;
        priceEgp: number;
      }[]
    >();

  // Group by requestId; keep only first-date trips for compact list card.
  const tripsByReq = new Map<string, TripRow[]>();
  for (const t of tripDocs) {
    const rid = String(t.requestId);
    if (t.date !== firstDateByReq.get(rid)) continue;
    if (!tripsByReq.has(rid)) tripsByReq.set(rid, []);
    tripsByReq.get(rid)!.push({
      vehicleType: t.vehicleType,
      pickupAddress: t.pickup?.address ?? "—",
      dropoffAddress: t.dropoff?.address ?? "—",
      pickup:
        typeof t.pickup?.lat === "number"
          ? { lat: t.pickup.lat, lng: t.pickup.lng }
          : null,
      dropoff:
        typeof t.dropoff?.lat === "number"
          ? { lat: t.dropoff.lat, lng: t.dropoff.lng }
          : null,
      pickupTime: t.pickupTime,
      arrivalTime: t.arrivalTime,
      priceEgp: t.priceEgp,
    });
  }

  // Serialise — strip ObjectId / Date to plain strings
  const bookings: BookingRow[] = rawList.map((b) => ({
    id: String(b._id),
    dates: (b.dates as string[]) ?? [],
    amountEgp: b.amountEgp as number,
    paymentStatus: (b.paymentStatus as PaymentStatus) ?? "pending",
    status: (b.status as BookingStatus) ?? "pending_payment",
    createdAt:
      b.createdAt instanceof Date
        ? b.createdAt.toISOString()
        : String(b.createdAt),
    trips: tripsByReq.get(String(b._id)) ?? [],
  }));

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={session.email} variant="app" backHref="/" />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
      >
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#0B1E3D",
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            My requests
          </h1>
          <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
            {total === 0
              ? hasFilters
                ? "No requests match these filters."
                : "No requests yet."
              : `${total} request${total === 1 ? "" : "s"}`}
          </p>
        </div>

        <FilterBar filters={[PAYMENT_OPTIONS, STATUS_OPTIONS]} />

        {bookings.length === 0 ? (
          <EmptyState
            icon="🚗"
            title={hasFilters ? "Nothing here" : "No trips yet"}
            description={
              hasFilters
                ? "Try clearing the filters to see all your requests."
                : "Book your first commute ride and it will appear here."
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
          bookings.map((booking) => {
            const needsPayment =
              booking.paymentStatus === "pending" ||
              booking.paymentStatus === "failed";
            const timedOut = booking.status === "time_out";
            return (
              <div
                key={booking.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #eef0f3",
                  marginBottom: 12,
                  overflow: "hidden",
                  opacity: timedOut ? 0.55 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <Link
                  href={`/my-requests/${booking.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <RouteMap
                    pickup={booking.trips[0]?.pickup}
                    dropoff={booking.trips[0]?.dropoff}
                    height={120}
                  />
                  {/* Booking header row */}
                  <div
                    style={{
                      padding: "14px 18px",
                      borderBottom: "1px solid #f4f6f8",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#5A6A7A",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                      }}
                    >
                      {booking.dates
                        .map((d) =>
                          new Date(`${d}T12:00:00`).toLocaleDateString(
                            "en-EG",
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            },
                          ),
                        )
                        .join(", ")}
                      {booking.dates.length > 1 &&
                        ` (× ${booking.dates.length} days)`}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <Pill
                          {...(PAY_PILL[booking.paymentStatus] ??
                            PAY_PILL.pending)}
                        />
                        <Pill
                          {...(STATUS_PILL[booking.status] ??
                            STATUS_PILL.pending_payment)}
                        />
                      </div>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          color: "#0B1E3D",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {booking.amountEgp} EGP
                      </span>
                    </div>
                  </div>

                      {/* Body */}
                      <div style={{ padding: "16px 18px 18px" }}>
                        {/* Vehicle + amount */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 16,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: "#E6F8F5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <Car size={17} color="#00806E" aria-hidden="true" />
                            </div>
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: "#0B1E3D",
                                }}
                              >
                                {vLabel}
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: "#9aa7b4",
                                }}
                              >
                                {booking.trips.length} trip
                                {booking.trips.length === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 18,
                              color: "#0B1E3D",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {booking.amountEgp}{" "}
                            <span style={{ fontSize: 12, color: "#9aa7b4" }}>
                              EGP
                            </span>
                          </span>
                        </div>

                        {/* Meta: trip count + requested date/time */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            marginBottom: 12,
                            fontSize: 12,
                            color: "#9aa7b4",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Car size={12} aria-hidden="true" />
                            {booking.trips.length} trip
                            {booking.trips.length === 1 ? "" : "s"}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <CalendarClock size={12} aria-hidden="true" />
                            {new Date(booking.createdAt).toLocaleString(
                              "en-EG",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>

                        {/* Route with connector */}
                        {first && (
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              padding: "14px",
                              background: "#fafbfc",
                              borderRadius: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                paddingTop: 4,
                              }}
                            >
                              <span
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: "50%",
                                  background: "#00C2A8",
                                }}
                              />
                              <span
                                style={{
                                  width: 2,
                                  flex: 1,
                                  minHeight: 18,
                                  background: "#e3e8ee",
                                  margin: "2px 0",
                                }}
                              />
                              <span
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: 2,
                                  background: "#E74C3C",
                                }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  margin: "0 0 12px",
                                  fontSize: 13,
                                  color: "#0B1E3D",
                                  fontWeight: 500,
                                }}
                              >
                                {truncate(first.pickupAddress)}
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 13,
                                  color: "#0B1E3D",
                                  fontWeight: 500,
                                }}
                              >
                                {truncate(first.dropoffAddress)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Times */}
                        {first && (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 12,
                            }}
                          >
                            {[
                              ["Pickup", to12h(first.pickupTime)],
                              ["Arrive", to12h(first.arrivalTime)],
                            ].map(([lbl, val]) => (
                              <div
                                key={lbl}
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "8px 10px",
                                  background: "#f6f8fa",
                                  borderRadius: 10,
                                }}
                              >
                                <Clock
                                  size={13}
                                  color="#5A6A7A"
                                  aria-hidden="true"
                                />
                                <span
                                  style={{ fontSize: 11, color: "#9aa7b4" }}
                                >
                                  {lbl}
                                </span>
                                <strong
                                  style={{
                                    fontSize: 13,
                                    color: "#0B1E3D",
                                    marginLeft: "auto",
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {val}
                                </strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 4,
                          padding: "12px 18px",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#00806E",
                          background: "#F5FBFA",
                          borderTop: "1px solid #eef6f5",
                        }}
                      >
                        View details
                        <ChevronRight size={15} aria-hidden="true" />
                      </div>
                    );
                  })}
                </Link>
                {needsPayment && (
                  <ContinueCheckoutButton
                    bookingId={booking.id}
                    amountEgp={booking.amountEgp}
                    walletBalance={walletBalance}
                  />
                )}
              </div>
            );
          })
        )}

        {bookings.length > 0 && (
          <Pagination page={page} totalPages={totalPages} />
        )}
      </main>
    </div>
  );
}
