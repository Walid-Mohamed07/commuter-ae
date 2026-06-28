import { VEHICLES, type VehicleKey } from "@/lib/config/vehicles";

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function toHHMM(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440; // wrap into a single day
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export interface PickupWindow {
  pickup_from: string;
  pickup_to: string;
}

/** pickup_to = arrival − duration − buffer ; pickup_from = pickup_to − window */
export function computePickupWindow(
  arrivalTime: string, // "HH:MM"
  durationMinutes: number,
  vehicle: VehicleKey,
): PickupWindow {
  const { buffer, window } = VEHICLES[vehicle];
  const to = toMinutes(arrivalTime) - durationMinutes - buffer;
  return { pickup_from: toHHMM(to - window), pickup_to: toHHMM(to) };
}
