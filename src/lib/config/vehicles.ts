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
    label: "Private car (private)",
    rate: 15,
    ride: "private",
    buffer: 20,
    window: 10,
  },
  taxi_private: {
    key: "taxi_private",
    label: "Taxi (private)",
    rate: 12,
    ride: "private",
    buffer: 20,
    window: 10,
  },
  taxi_shared: {
    key: "taxi_shared",
    label: "Taxi (shared)",
    rate: 9,
    ride: "shared",
    buffer: 30,
    window: 15,
  },
  van_shared: {
    key: "van_shared",
    label: "Van (shared)",
    rate: 7,
    ride: "shared",
    buffer: 45,
    window: 15,
  },
  microbus_shared: {
    key: "microbus_shared",
    label: "Microbus (shared)",
    rate: 5,
    ride: "shared",
    buffer: 45,
    window: 15,
  },
};

export const VEHICLE_LIST = Object.values(VEHICLES);
export const MIN_FARE = 20;

export function priceFor(distanceKm: number, key: VehicleKey): number {
  return Math.max(MIN_FARE, Math.round(distanceKm * VEHICLES[key].rate));
}
