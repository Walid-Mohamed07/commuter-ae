import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { User } from "@/models/User";
import { connectDB } from "@/lib/db/mongoose";
import { Users, ShieldCheck } from "lucide-react";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const users = await User.find().sort({ createdAt: -1 }).select("-passwordHash").lean();

  return (
    <main style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #f8f9fa 0%, #eef2f5 100%)", padding: "32px 20px 80px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#00C2A8" }}>Admin panel</p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 800, color: "#0B1E3D" }}>Users</h1>
          </div>
          <a href="/admin/dashboard" style={{ textDecoration: "none", padding: "11px 16px", borderRadius: 999, color: "#0B1E3D", fontWeight: 700, background: "#ffffff", border: "1px solid #e8edf0" }}>Back to dashboard</a>
        </div>

        <section style={{ borderRadius: 24, background: "#ffffff", border: "1px solid #e8edf0", boxShadow: "0 10px 35px rgba(11,30,61,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #eef2f5", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(0,194,168,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={20} style={{ color: "#00C2A8" }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0B1E3D" }}>Registered accounts</h2>
              <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 14 }}>A quick view of all users and their roles.</p>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Name</th>
                  <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Phone</th>
                  <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Email</th>
                  <th style={{ textAlign: "left", padding: "14px 16px", color: "#0B1E3D", fontSize: 13 }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: Record<string, unknown>) => (
                  <tr key={String(user._id)} style={{ borderTop: "1px solid #eef2f5" }}>
                    <td style={{ padding: "14px 16px", color: "#0B1E3D", fontWeight: 600 }}>{String(user.name ?? "—")}</td>
                    <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{String(user.phone ?? "—")}</td>
                    <td style={{ padding: "14px 16px", color: "#5A6A7A" }}>{String(user.email ?? "—")}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: user.role === "admin" ? "#0B1E3D" : "#00C2A8", background: user.role === "admin" ? "#f8f9fa" : "rgba(0,194,168,0.12)" }}>
                        {user.role === "admin" ? <ShieldCheck size={13} /> : null}
                        {String(user.role ?? "user")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
