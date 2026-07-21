import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Trip } from "@/models/Trip";
import { Availability } from "@/models/Availability";
import { ShieldCheck, Users, Route, CalendarClock } from "lucide-react";

const statCardStyle = {
  background: "#ffffff",
  border: "1px solid #e8edf0",
  borderRadius: 20,
  padding: "24px",
  boxShadow: "0 10px 35px rgba(11,30,61,0.05)",
} as const;

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const [userCount, tripCount, availabilityCount] = await Promise.all([
    User.countDocuments(),
    Trip.countDocuments(),
    Availability.countDocuments(),
  ]);

  const cards = [
    { title: "Users", value: userCount, icon: Users, accent: "#00C2A8" },
    { title: "Trips", value: tripCount, icon: Route, accent: "#0B1E3D" },
    { title: "Availability", value: availabilityCount, icon: CalendarClock, accent: "#F5A623" },
  ];

  return (
    <main style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #f8f9fa 0%, #eef2f5 100%)", padding: "32px 20px 80px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00C2A8" }}>Admin panel</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 800, color: "#0B1E3D" }}>Dashboard</h1>
          </div>
          <a href="/admin/users" style={{ textDecoration: "none", padding: "11px 16px", borderRadius: 999, color: "#ffffff", fontWeight: 700, background: "#0B1E3D" }}>View users</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
          {cards.map(({ title, value, icon: Icon, accent }) => (
            <div key={title} style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}14`, marginBottom: 16 }}>
                <Icon size={24} style={{ color: accent }} />
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#5A6A7A" }}>{title}</p>
              <h2 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 800, color: "#0B1E3D" }}>{value}</h2>
            </div>
          ))}
        </div>

        <div style={{ ...statCardStyle, marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <ShieldCheck size={20} style={{ color: "#00C2A8" }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0B1E3D" }}>Admin tools</h2>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/admin/users" style={{ textDecoration: "none", color: "#0B1E3D", fontWeight: 700, padding: "10px 14px", borderRadius: 999, background: "#f0f4f8" }}>Manage users</a>
            <a href="/admin/availability" style={{ textDecoration: "none", color: "#0B1E3D", fontWeight: 700, padding: "10px 14px", borderRadius: 999, background: "#f0f4f8" }}>Manage availability</a>
            <a href="/admin/trips" style={{ textDecoration: "none", color: "#0B1E3D", fontWeight: 700, padding: "10px 14px", borderRadius: 999, background: "#f0f4f8" }}>Manage trips</a>
          </div>
        </div>
      </div>
    </main>
  );
}
