import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import AvailabilityClient from "./AvailabilityClient";

export const metadata = { title: "Availability — Commuter" };

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/availability");
  if (session.role !== "driver") redirect("/my-trips");

  await connectDB();
  const records = await Availability.find({ driverId: session.userId })
    .sort({ date: 1 })
    .lean();

  return (
    <AvailabilityClient
      email={session.email}
      initialRecords={records.map((r) => ({
        _id: String(r._id),
        date: r.date,
        startLocation: r.startLocation,
        endLocation: r.endLocation,
        startTime: r.startTime,
        endTime: r.endTime,
      }))}
    />
  );
}
