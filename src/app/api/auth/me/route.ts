import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { getSession } from "@/lib/auth/session";
import { carTypeToCapacity, type CarType } from "@/lib/config/driver";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findById(session.userId)
    .select("name email phone role")
    .lean();
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (session.role !== "driver") return NextResponse.json(user);

  const driver = await Driver.findOne({ userId: session.userId }).lean();
  if (!driver)
    return NextResponse.json(
      { error: "Driver profile not found." },
      { status: 404 },
    );

  return NextResponse.json({ ...user, driver });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, phone } = body;
    if (!name?.trim())
      return NextResponse.json({ error: "Name is required." }, { status: 400 });

    await connectDB();
    const user = await User.findByIdAndUpdate(
      session.userId,
      { name: name.trim(), phone: phone?.trim() || undefined },
      { new: true, select: "name email phone role" },
    ).lean();

    if (!user)
      return NextResponse.json({ error: "User not found." }, { status: 404 });

    if (session.role !== "driver") return NextResponse.json(user);

    const {
      gender,
      carType,
      carBrand,
      carModel,
      modelYear,
      vehicleColor,
      plateChar1,
      plateChar2,
      plateChar3,
      plateDigits,
      licenseExpiry,
      documents,
    } = body;

    const ARABIC_CHAR = /^[\u0600-\u06FF]$/;

    const driverUpdate: Record<string, unknown> = {};
    if (gender === "male" || gender === "female") driverUpdate.gender = gender;
    if (["private", "taxi", "van", "microbus"].includes(carType)) {
      driverUpdate.carType = carType;
      // Server-authoritative capacity — never trust client input.
      driverUpdate.carCapacity = carTypeToCapacity(carType as CarType);
    }
    if (carBrand?.trim()) driverUpdate.carBrand = carBrand.trim();
    if (carModel?.trim()) driverUpdate.carModel = carModel.trim();
    if (Number.isInteger(modelYear) && modelYear > 1900 && modelYear < 2100)
      driverUpdate.modelYear = modelYear;
    if (vehicleColor?.trim()) driverUpdate.vehicleColor = vehicleColor.trim();
    if (ARABIC_CHAR.test(plateChar1)) driverUpdate.plateChar1 = plateChar1;
    if (ARABIC_CHAR.test(plateChar2)) driverUpdate.plateChar2 = plateChar2;
    if (ARABIC_CHAR.test(plateChar3)) driverUpdate.plateChar3 = plateChar3;
    if (/^\d{4}$/.test(plateDigits)) driverUpdate.plateDigits = plateDigits;
    if (licenseExpiry?.trim())
      driverUpdate.licenseExpiry = licenseExpiry.trim();

    const ALLOWED_DOC_KEYS = [
      "nationalIdFront",
      "nationalIdBack",
      "drivingLicense",
      "carLicenseFront",
      "carLicenseBack",
      "criminalRecord",
      "profilePic",
      "carImage",
    ];
    if (documents && typeof documents === "object") {
      for (const key of ALLOWED_DOC_KEYS) {
        if (typeof documents[key] === "string" && documents[key]) {
          driverUpdate[`documents.${key}`] = documents[key];
        }
      }
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: session.userId },
      driverUpdate,
      { new: true },
    ).lean();

    return NextResponse.json({ ...user, driver });
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
