import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/services/profile";
import ProfileClient from "./ProfileClient";
import DriverProfileClient from "./DriverProfileClient";

export const metadata = { title: "Profile — Commuter" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/profile");

  const profile = await getProfile(session.userId, session.role);
  if (!profile) redirect("/login");

  if (profile.role === "driver") {
    return (
      <DriverProfileClient
        initialName={profile.name}
        email={profile.email}
        initialPhone={profile.phone}
        gender={profile.gender}
        carType={profile.carType}
        carBrand={profile.carBrand}
        carModel={profile.carModel}
        modelYear={profile.modelYear}
        vehicleColor={profile.vehicleColor}
        plateChar1={profile.plateChar1}
        plateChar2={profile.plateChar2}
        plateChar3={profile.plateChar3}
        plateDigits={profile.plateDigits}
        licenseExpiry={profile.licenseExpiry}
        carCapacity={profile.carCapacity}
        documents={profile.documents}
        verificationStatus={profile.verificationStatus}
        profileSince={profile.profileSince}
        initialSavedAddresses={profile.savedAddresses}
      />
    );
  }

  return (
    <ProfileClient
      initialName={profile.name}
      email={profile.email}
      initialPhone={profile.phone}
      initialSavedAddresses={profile.savedAddresses}
    />
  );
}
