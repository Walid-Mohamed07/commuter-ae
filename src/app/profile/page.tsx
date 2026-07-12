import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import ProfileClient from "./ProfileClient";
import DriverProfileClient from "./DriverProfileClient";
import type { SavedAddress } from "@/types/shared";

export const metadata = { title: "Profile — Commuter" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/profile");

  await connectDB();

  if (session.role === "driver") {
    const user = await User.findById(session.userId)
      .select("name email phone savedAddresses")
      .lean<{
        name: string;
        email: string;
        phone?: string;
        savedAddresses?: SavedAddress[];
      }>();
    if (!user) redirect("/login");

    const driver = await Driver.findOne({ userId: session.userId }).lean<{
      gender: "male" | "female";
      carType?: "private" | "taxi" | "van" | "microbus";
      carBrand?: string;
      carModel?: string;
      modelYear?: number;
      vehicleColor?: string;
      plateChar1?: string;
      plateChar2?: string;
      plateChar3?: string;
      plateDigits?: string;
      licenseExpiry?: string;
      carCapacity?: number;
      verificationStatus: "incomplete" | "pending" | "verified";
      documents: Record<string, string | null>;
      createdAt: Date;
    }>();
    if (!driver) redirect("/login");

    return (
      <DriverProfileClient
        initialName={user.name}
        email={user.email}
        initialPhone={user.phone ?? ""}
        gender={driver.gender}
        carType={driver.carType ?? ""}
        carBrand={driver.carBrand ?? ""}
        carModel={driver.carModel ?? ""}
        modelYear={driver.modelYear ?? null}
        vehicleColor={driver.vehicleColor ?? ""}
        plateChar1={driver.plateChar1 ?? ""}
        plateChar2={driver.plateChar2 ?? ""}
        plateChar3={driver.plateChar3 ?? ""}
        plateDigits={driver.plateDigits ?? ""}
        licenseExpiry={driver.licenseExpiry ?? ""}
        carCapacity={driver.carCapacity}
        documents={driver.documents ?? {}}
        verificationStatus={driver.verificationStatus}
        profileSince={driver.createdAt.toISOString()}
        initialSavedAddresses={JSON.parse(JSON.stringify(user.savedAddresses ?? []))}
      />
    );
  }

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
      initialSavedAddresses={JSON.parse(JSON.stringify(user.savedAddresses ?? []))}
    />
  );
}
