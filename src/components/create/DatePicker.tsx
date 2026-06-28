"use client";
import { Calendar } from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";

interface Props {
  value: string; // "YYYY-MM-DD" (tomorrow)
}

export default function DatePicker({ value }: Props) {
  const d = value
    ? new Date(`${value}T00:00:00`)
    : addDays(startOfDay(new Date()), 1);
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#0B1E3D",
          margin: "0 0 10px",
        }}
      >
        Trip date
      </p>
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 14px",
          background: "#eff7f6",
          borderRadius: 12,
          border: "1.5px solid #c8e8e4",
        }}
      >
        <Calendar
          size={18}
          style={{ color: "#00C2A8", flexShrink: 0 }}
          aria-hidden="true"
        />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0B1E3D" }}>
            {format(d, "EEEE, MMM d, yyyy")}
          </div>
          <div style={{ fontSize: 12, color: "#5A6A7A", marginTop: 1 }}>
            Tomorrow — all trips are scheduled for the next day
          </div>
        </div>
      </div>
    </div>
  );
}
