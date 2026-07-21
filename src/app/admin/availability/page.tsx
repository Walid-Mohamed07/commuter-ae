import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import AdminAvailabilityTable from "@/components/admin/AdminAvailabilityTable";

export default async function AdminAvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const records = await Availability.find()
    .sort({ createdAt: -1 })
    .populate("driverId", "name phone")
    .lean();

  return (
    <main style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #f8f9fa 0%, #eef2f5 100%)", padding: "32px 20px 80px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00C2A8" }}>Admin panel</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 800, color: "#0B1E3D" }}>Availability</h1>
          </div>
          <a href="/admin/dashboard" style={{ textDecoration: "none", padding: "11px 16px", borderRadius: 999, color: "#0B1E3D", fontWeight: 700, background: "#ffffff", border: "1px solid #e8edf0" }}>Back to dashboard</a>
        </div>

        <AdminAvailabilityTable initialRecords={records.map((record) => ({
          _id: String(record._id),
          driver: record.driverId
            ? {
                _id: String((record.driverId as { _id?: unknown })._id ?? record.driverId),
                name: String((record.driverId as { name?: unknown }).name ?? ""),
                phone: String((record.driverId as { phone?: unknown }).phone ?? ""),
              }
            : null,
          date: String(record.date ?? ""),
          startTime: String(record.startTime ?? ""),
          endTime: String(record.endTime ?? ""),
        }))} />
      </div>
    </main>
  );
}
