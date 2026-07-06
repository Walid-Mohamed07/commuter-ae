import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import ProfileClient from "./ProfileClient";
import type { SavedAddress } from "@/types/shared";

export const metadata = { title: "Profile — Commuter" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/profile");

  await connectDB();
  const user = await User.findById(session.userId)
    .select("name email phone savedAddresses")
    .lean<{
      name: string;
      email: string;
      phone?: string;
      savedAddresses?: SavedAddress[];
    }>();

  if (!user) redirect("/login");

  return (
    <ProfileClient
      initialName={user.name}
      email={user.email}
      initialPhone={user.phone ?? ""}
      initialSavedAddresses={user.savedAddresses ?? []}
    />
  );
}
