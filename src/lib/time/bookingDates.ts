import { addDays, format, startOfDay } from "date-fns";

/** Earliest selectable booking date: tomorrow, or day-after-tomorrow if now >= 20:00 local. */
export function earliestBookingDate(now: Date = new Date()): string {
  const offset = now.getHours() >= 20 ? 2 : 1;
  return format(addDays(startOfDay(now), offset), "yyyy-MM-dd");
}

/** 7 selectable dates starting FROM the given start date (defaults to earliestBookingDate). */
export function bookingWindow(
  startDate?: string,
  now: Date = new Date(),
): string[] {
  const start = startDate ?? earliestBookingDate(now);
  const startDateObj = new Date(`${start}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(startDateObj, i), "yyyy-MM-dd"),
  );
}

/** Whether `startDate` ("YYYY-MM-DD") is a valid anchor — must be on or after the earliest date. */
export function isValidStartDate(
  startDate: string,
  now: Date = new Date(),
): boolean {
  return startDate >= earliestBookingDate(now);
}

/** Whether `date` ("YYYY-MM-DD") falls inside the 7-day window anchored at `startDate`. */
export function isDateInWindow(
  date: string,
  startDate?: string,
  now: Date = new Date(),
): boolean {
  if (startDate && !isValidStartDate(startDate, now)) return false;
  return bookingWindow(startDate, now).includes(date);
}
