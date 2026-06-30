export type VehicleKey =
  | "private_car"
  | "taxi_private"
  | "taxi_shared"
  | "van_shared"
  | "microbus_shared";
export type RideType = "private" | "shared";

export interface VehicleConfig {
  key: VehicleKey;
  label: string;
  rate: number; // EGP per km
  ride: RideType;
  buffer: number; // minutes subtracted before the pickup window
  window: number; // width of the pickup window in minutes
}

export const VEHICLES: Record<VehicleKey, VehicleConfig> = {
  private_car: {
    key: "private_car",
    label: "Private car",
    rate: 15,
    ride: "private",
    buffer: 20,
    window: 10,
  },
  taxi_private: {
    key: "taxi_private",
    label: "Private Taxi",
    rate: 12,
    ride: "private",
    buffer: 20,
    window: 10,
  },
  taxi_shared: {
    key: "taxi_shared",
    label: "Shared Taxi",
    rate: 9,
    ride: "shared",
    buffer: 30,
    window: 15,
  },
  van_shared: {
    key: "van_shared",
    label: "Van",
    rate: 7,
    ride: "shared",
    buffer: 45,
    window: 20,
  },
  microbus_shared: {
    key: "microbus_shared",
    label: "Microbus",
    rate: 5,
    ride: "shared",
    buffer: 45,
    window: 25,
  },
};

export const VEHICLE_LIST = Object.values(VEHICLES);

export function priceFor(distanceKm: number, key: VehicleKey): number {
  return Math.round(distanceKm * VEHICLES[key].rate);
}

/** Max extra passengers allowed per vehicle type */
export function maxExtraPassengers(key: VehicleKey): number {
  if (key === "van_shared") return 4;
  if (key === "microbus_shared") return 8;
  return 2; // private_car, taxi_private, taxi_shared
}

/**
 * Final price factoring in extra passengers.
 * Formula: round(basePrice * totalPeople * 1.05) when extraPassengers > 0,
 * else basePrice unchanged.
 */
export function finalPrice(
  basePrice: number,
  extraPassengers: number,
  vehicleType: VehicleKey,
): number {
  if (
    vehicleType === "taxi_shared" ||
    vehicleType === "van_shared" ||
    vehicleType === "microbus_shared"
  ) {
    if (!extraPassengers || extraPassengers <= 0) return basePrice;
    return Math.round(basePrice * (extraPassengers + 1) * 0.95);
  }
  return basePrice;
}
