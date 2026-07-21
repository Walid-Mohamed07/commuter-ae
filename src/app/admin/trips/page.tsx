"use client";

import { useEffect, useState } from "react";
import { Route, Trash2, UserPlus, X, MapPin, Inbox } from "lucide-react";

interface DriverOption {
  _id: string;
  name?: string;
  phone?: string;
  startTime?: string;
  endTime?: string;
}

interface TripRow {
  _id: string;
  tripNumber?: number | null;
  date: string;
  pickupTime: string;
  arrivalTime: string;
  pickup?: { address?: string } | null;
  dropoff?: { address?: string } | null;
  status: string;
  driverId?: { _id?: string; name?: string; phone?: string } | null;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label?: string }> = {
  scheduled: { bg: "rgba(0,194,168,0.12)", color: "#00877A" },
  confirmed: { bg: "rgba(0,194,168,0.12)", color: "#00877A" },
  in_progress: { bg: "rgba(232,163,61,0.16)", color: "#B4790C", label: "In progress" },
  active: { bg: "rgba(232,163,61,0.16)", color: "#B4790C" },
  completed: { bg: "rgba(90,106,122,0.12)", color: "#4A5A6A" },
  cancelled: { bg: "rgba(225,82,82,0.12)", color: "#C13E3E" },
};

function getStatusStyle(status: string) {
  const key = status?.toLowerCase().replace(/\s+/g, "_") ?? "";
  return STATUS_STYLES[key] ?? { bg: "rgba(90,106,122,0.1)", color: "#5A6A7A" };
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalTripId, setModalTripId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);

  async function loadTrips() {
    try {
      const res = await fetch("/api/admin/trips");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load trips");
      setTrips(data.trips ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  }

  async function openAssignModal(tripId: string) {
    setModalTripId(tripId);
    setDrivers([]);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/available-drivers`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load drivers");
      setDrivers(data.drivers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    }
  }

  async function assignDriver(driverId: string) {
    if (!modalTripId) return;
    try {
      const res = await fetch(`/api/admin/trips/${modalTripId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to assign driver");
      setModalTripId(null);
      await loadTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign driver");
    }
  }

  async function deleteTrip(id: string) {
    const confirmed = window.confirm("Delete this trip? This can't be undone.");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/trips/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete trip");
      setTrips((current) => current.filter((trip) => trip._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trip");
    }
  }

  useEffect(() => {
    let active = true;

    const runLoad = async () => {
      try {
        const res = await fetch("/api/admin/trips");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load trips");
        if (active) setTrips(data.trips ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load trips");
      } finally {
        if (active) setLoading(false);
      }
    };

    void runLoad();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="trips-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

        .trips-board {
          --ink: #0B1E3D;
          --teal: #00C2A8;
          --teal-deep: #00877A;
          --amber: #E8A33D;
          --rose: #E15252;
          --slate: #5A6A7A;
          --line: #E6EAEC;
          --canvas: #F6F8F7;
          --surface: #FFFFFF;
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100dvh;
          background: var(--canvas);
          padding: 32px 20px 80px;
        }
        .trips-board * { box-sizing: border-box; }
        .trips-board .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .trips-board .display { font-family: 'Space Grotesk', system-ui, sans-serif; }

        .trips-board table { width: 100%; border-collapse: collapse; }
        .trips-board thead th {
          text-align: left;
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--slate);
          border-bottom: 1px solid var(--line);
        }
        .trips-board tbody tr {
          border-bottom: 1px solid var(--line);
          transition: background 0.12s ease;
        }
        .trips-board tbody tr:hover { background: rgba(0,194,168,0.035); }
        .trips-board tbody tr:last-child { border-bottom: none; }
        .trips-board td { padding: 16px; vertical-align: middle; }

        .route-line {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 220px;
        }
        .route-line .stops {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .route-line .addr {
          font-size: 13px;
          color: var(--ink);
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .route-line .rail {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 36px;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .route-line .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--teal);
          flex-shrink: 0;
        }
        .route-line .dot.end { background: var(--ink); }
        .route-line .dash {
          width: 1px;
          flex: 1;
          background-image: linear-gradient(var(--slate) 55%, transparent 45%);
          background-size: 1px 6px;
          opacity: 0.5;
        }

        .status-pill {
          display: inline-block;
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .driver-chip { display: flex; align-items: center; gap: 9px; }
        .driver-chip .avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--ink);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .driver-chip.unassigned .avatar { background: var(--line); color: var(--slate); }
        .driver-chip .name { font-size: 13px; color: var(--ink); font-weight: 500; }
        .driver-chip .unassigned-label { font-size: 13px; color: var(--slate); font-style: italic; }

        .action-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: opacity 0.12s ease;
        }
        .action-btn:hover { opacity: 0.75; }
        .action-btn.assign { background: rgba(0,194,168,0.1); color: var(--teal-deep); }
        .action-btn.delete { background: rgba(225,82,82,0.08); color: var(--rose); }

        .skeleton-row td { padding: 16px; }
        .skeleton-bar {
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(90deg, var(--line) 25%, #EEF1F2 37%, var(--line) 63%);
          background-size: 400% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .skeleton-bar { animation: none; }
        }
      `}</style>

      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="mono" style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00877A" }}>
              Admin · Dispatch
            </p>
            <h1 className="display" style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "#0B1E3D" }}>
              Trips
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5A6A7A" }}>
              {loading ? "Loading the board…" : `${trips.length} trip${trips.length === 1 ? "" : "s"} on the board`}
            </p>
          </div>
          <a
            href="/admin/dashboard"
            style={{ textDecoration: "none", padding: "11px 18px", borderRadius: 10, color: "#0B1E3D", fontWeight: 600, fontSize: 14, background: "#ffffff", border: "1px solid #E6EAEC" }}
          >
            Back to dashboard
          </a>
        </div>

        {error ? (
          <p role="alert" style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(225,82,82,0.08)", color: "#C13E3E", border: "1px solid rgba(225,82,82,0.2)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}

        <section style={{ borderRadius: 20, background: "#ffffff", border: "1px solid #E6EAEC", boxShadow: "0 10px 35px rgba(11,30,61,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #EEF2F5", display: "flex", alignItems: "center", gap: 12, borderTop: "3px solid #00C2A8" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0,194,168,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Route size={18} style={{ color: "#00877A" }} />
            </div>
            <div>
              <h2 className="display" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0B1E3D" }}>Manage trips</h2>
              <p style={{ margin: "3px 0 0", color: "#5A6A7A", fontSize: 13 }}>Assign a driver or remove a trip from the schedule.</p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Route</th>
                  <th>Date / Time</th>
                  <th>Status</th>
                  <th>Driver</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="skeleton-row">
                      <td><div className="skeleton-bar" style={{ width: 48 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 160 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 100 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 70 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 90 }} /></td>
                      <td><div className="skeleton-bar" style={{ width: 120 }} /></td>
                    </tr>
                  ))
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "56px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
                        <Inbox size={28} style={{ color: "#C7D0D4" }} />
                        <p style={{ margin: 0, fontWeight: 600, color: "#0B1E3D", fontSize: 15 }}>No trips on the board</p>
                        <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>New trips will show up here once they're scheduled.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  trips.map((trip, index) => {
                    const statusStyle = getStatusStyle(trip.status);
                    const driverName = trip.driverId?.name;
                    return (
                      <tr key={trip._id ? `${trip._id}-${index}` : `trip-${index}`}>
                        <td>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
                            {trip.tripNumber != null ? `#${String(trip.tripNumber).padStart(3, "0")}` : `#${String(trip._id).slice(-6)}`}
                          </span>
                        </td>
                        <td>
                          <div className="route-line">
                            <div className="rail">
                              <span className="dot" />
                              <span className="dash" />
                              <span className="dot end" />
                            </div>
                            <div className="stops">
                              <span className="addr" title={trip.pickup?.address ?? undefined}>
                                {trip.pickup?.address ?? "No pickup set"}
                              </span>
                              <span className="addr" title={trip.dropoff?.address ?? undefined} style={{ color: "#5A6A7A" }}>
                                {trip.dropoff?.address ?? "No dropoff set"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: "#0B1E3D", fontWeight: 500 }}>{trip.date}</div>
                          <div className="mono" style={{ fontSize: 12, color: "#5A6A7A", marginTop: 2 }}>{trip.pickupTime}</div>
                        </td>
                        <td>
                          <span className="status-pill" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                            {statusStyle.label ?? trip.status}
                          </span>
                        </td>
                        <td>
                          <div className={`driver-chip ${driverName ? "" : "unassigned"}`}>
                            <span className="avatar">
                              {driverName ? initials(driverName) : <MapPin size={12} />}
                            </span>
                            {driverName ? (
                              <span className="name">{driverName}</span>
                            ) : (
                              <span className="unassigned-label">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => void openAssignModal(trip._id)} className="action-btn assign">
                              <UserPlus size={14} /> Assign driver
                            </button>
                            <button type="button" onClick={() => void deleteTrip(trip._id)} className="action-btn delete">
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalTripId ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,30,61,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1200 }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#ffffff", borderRadius: 18, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 className="trips-board display" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0B1E3D" }}>Assign driver</h3>
              <button type="button" onClick={() => setModalTripId(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5A6A7A" }}>
                <X size={18} />
              </button>
            </div>
            {drivers.length === 0 ? (
              <p style={{ color: "#5A6A7A", fontSize: 14 }}>No drivers are available for this trip's date.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {drivers.map((driver, index) => (
                  <button
                    key={driver._id ? `${driver._id}-${index}` : `driver-${index}`}
                    type="button"
                    onClick={() => void assignDriver(String(driver._id))}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #E6EAEC", borderRadius: 12, padding: "12px 14px", background: "#F6F8F7", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#0B1E3D", color: "#fff", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {initials(driver.name)}
                      </span>
                      <span>
                        <strong style={{ color: "#0B1E3D", fontSize: 14 }}>{driver.name ?? "Driver"}</strong>
                        <div style={{ color: "#5A6A7A", fontSize: 12.5 }}>{driver.phone ?? "No phone on file"}</div>
                      </span>
                    </span>
                    <span style={{ color: "#00877A", fontWeight: 700, fontSize: 13 }}>Assign</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}