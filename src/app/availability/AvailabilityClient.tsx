"use client";
import { useState } from "react";
import { format, addDays, startOfDay } from "date-fns";
import {
  Plus,
  MapPin,
  Flag,
  Clock,
  Trash2,
  Loader2,
  CalendarClock,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import BottomSheet from "@/components/shared/BottomSheet";
import EmptyState from "@/components/shared/EmptyState";
import AddressInput from "@/components/landing/AddressInput";
import type { TripPoint } from "@/lib/store/useTripStore";

interface Point {
  address: string;
  lat: number;
  lng: number;
}

interface AvailabilityRecord {
  _id: string;
  date: string;
  startLocation: Point;
  endLocation: Point;
  startTime: string;
  endTime: string;
}

const NEXT_DAYS = Array.from({ length: 7 }, (_, i) =>
  addDays(startOfDay(new Date()), i),
);

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  display: "block",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  background: "#f8f9fa",
  border: "1.5px solid #e8edf0",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  color: "#0B1E3D",
  outline: "none",
  boxSizing: "border-box",
};

export default function AvailabilityClient({
  email,
  initialRecords,
}: {
  email: string;
  initialRecords: AvailabilityRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [startLocation, setStartLocation] = useState<TripPoint | null>(null);
  const [endLocation, setEndLocation] = useState<TripPoint | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleDate(d: string) {
    setSelectedDates((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  function resetForm() {
    setSelectedDates([]);
    setStartLocation(null);
    setEndLocation(null);
    setStartTime("");
    setEndTime("");
    setError("");
  }

  async function handleSubmit() {
    if (!selectedDates.length) {
      setError("Select at least one date.");
      return;
    }
    if (!startLocation || !endLocation) {
      setError("Start and end locations are required.");
      return;
    }
    if (!startTime || !endTime) {
      setError("Start and end time are required.");
      return;
    }
    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/driver/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: selectedDates,
          startLocation,
          endLocation,
          startTime,
          endTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create availability.");
        setSaving(false);
        return;
      }
      setRecords((prev) =>
        [...prev, ...data.records].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setModalOpen(false);
      resetForm();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/driver/availability/${id}`, {
        method: "DELETE",
      });
      if (res.ok) setRecords((prev) => prev.filter((r) => r._id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={email} role="driver" variant="app" backHref="/" />

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0B1E3D", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              Availability
            </h1>
            <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
              Set when you&apos;re available to drive.
            </p>
          </div>
          {records.length > 0 && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 44,
                padding: "0 16px",
                background: "#0B1E3D",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Add availability
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "40px 24px 56px",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #eef0f3",
            }}
          >
            <EmptyState
              icon="📅"
              title="No availability yet"
              description="Add the dates, locations and hours you're available to drive."
            />
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 48,
                padding: "0 22px",
                background: "#0B1E3D",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 15,
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Plus size={18} aria-hidden="true" />
              Add availability
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {records.map((r) => (
              <div
                key={r._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  background: "#ffffff",
                  borderRadius: 14,
                  border: "1px solid #eef0f3",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "#E6F8F5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <CalendarClock size={20} color="#00806E" aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#0B1E3D" }}>
                    {format(new Date(`${r.date}T12:00:00`), "EEE, MMM d, yyyy")}
                  </p>
                  <p style={{ margin: "0 0 2px", fontSize: 13, color: "#5A6A7A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.startLocation.address} → {r.endLocation.address}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#5A6A7A", display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} aria-hidden="true" /> {to12h(r.startTime)} – {to12h(r.endTime)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r._id)}
                  disabled={deletingId === r._id}
                  aria-label="Delete availability"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: "none",
                    background: "#FFEBEE",
                    color: "#E74C3C",
                    cursor: deletingId === r._id ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {deletingId === r._id ? (
                    <Loader2 size={16} className="spin" aria-hidden="true" />
                  ) : (
                    <Trash2 size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomSheet
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Add availability"
      >
        <div style={{ padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>
              Available days <span aria-hidden="true" style={{ color: "#e74c3c" }}>*</span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {NEXT_DAYS.map((d) => {
                const iso = format(d, "yyyy-MM-dd");
                const selected = selectedDates.includes(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => toggleDate(iso)}
                    aria-pressed={selected}
                    style={{
                      minHeight: 44,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: `1.5px solid ${selected ? "#00C2A8" : "#e8edf0"}`,
                      background: selected ? "#E6F8F5" : "#f8f9fa",
                      color: selected ? "#00806E" : "#0B1E3D",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {format(d, "EEE, MMM d")}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Start location <span aria-hidden="true" style={{ color: "#e74c3c" }}>*</span>
            </label>
            <AddressInput
              placeholder="Where do you start?"
              value={startLocation}
              onChange={setStartLocation}
              icon={<MapPin size={17} aria-hidden="true" />}
            />
          </div>

          <div>
            <label style={labelStyle}>
              End location <span aria-hidden="true" style={{ color: "#e74c3c" }}>*</span>
            </label>
            <AddressInput
              placeholder="Where do you end?"
              value={endLocation}
              onChange={setEndLocation}
              icon={<Flag size={17} aria-hidden="true" />}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="a-start-time" style={labelStyle}>
                Start time <span aria-hidden="true" style={{ color: "#e74c3c" }}>*</span>
              </label>
              <input
                id="a-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="a-end-time" style={labelStyle}>
                End time <span aria-hidden="true" style={{ color: "#e74c3c" }}>*</span>
              </label>
              <input
                id="a-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <p role="alert" aria-live="assertive" style={{ fontSize: 13, color: "#e74c3c", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 52,
              background: saving ? "#5A6A7A" : "#0B1E3D",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              borderRadius: 12,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving && <Loader2 size={18} className="spin" aria-hidden="true" />}
            {saving ? "Saving…" : "Save availability"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
