import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listDriverAvailability } from "@/lib/services/availability";
import AvailabilityClient from "./AvailabilityClient";

export const metadata = { title: "Availability — Commuter" };

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/availability");
  if (session.role !== "driver") redirect("/my-trips");

  const records = await listDriverAvailability(session.userId);

  return <AvailabilityClient email={session.email} initialRecords={records} />;
}

