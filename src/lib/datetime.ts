import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";

/** Loyiha vaqt zonasi. */
export const TZ = "Asia/Tashkent";

/** UTC sanani Toshkent vaqtida formatlash. */
export function formatTashkent(date: Date | string | number, pattern = "dd.MM.yyyy HH:mm"): string {
  return formatInTimeZone(new Date(date), TZ, pattern);
}

/** Faqat sana (dd.MM.yyyy) Toshkent bo'yicha. */
export function formatDate(date: Date | string | number): string {
  return formatInTimeZone(new Date(date), TZ, "dd.MM.yyyy");
}

/** Faqat vaqt (HH:mm) Toshkent bo'yicha. */
export function formatTime(date: Date | string | number): string {
  return formatInTimeZone(new Date(date), TZ, "HH:mm");
}

/**
 * Toshkent kunining boshlanishi/oxirini UTC Date sifatida qaytaradi.
 * Dashboard filtrlari uchun ("bugun", "kecha" va h.k.).
 */
export function tashkentDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const zoned = toZonedTime(date, TZ);
  const y = zoned.getFullYear();
  const m = zoned.getMonth();
  const d = zoned.getDate();
  // Toshkent yarim tunini yasab, UTC ga o'giramiz
  const startLocal = new Date(y, m, d, 0, 0, 0, 0);
  const endLocal = new Date(y, m, d, 23, 59, 59, 999);
  return {
    start: fromZonedTime(startLocal, TZ),
    end: fromZonedTime(endLocal, TZ),
  };
}

/** Toshkent bo'yicha "YYYY-MM-DD" kalit (MarketingReport.date uchun). */
export function tashkentDateKey(date: Date = new Date()): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

const UZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

/** Qayta aloqa tegi uchun qisqa o'zbekcha sana: masalan "31-avg, 09:00". */
export function formatCallbackShort(date: Date | string | number): string {
  const day = formatInTimeZone(date, TZ, "d");
  const monthIdx = Number(formatInTimeZone(date, TZ, "M")) - 1;
  const time = formatInTimeZone(date, TZ, "HH:mm");
  return `${day}-${UZ_MONTHS_SHORT[monthIdx] ?? ""}, ${time}`;
}

/** Toshkent kaliti (yoki Date) uchun @db.Date ustuniga mos UTC-yarim tun Date. */
export function tashkentDbDate(dateOrKey: Date | string = new Date()): Date {
  const key = typeof dateOrKey === "string" ? dateOrKey : tashkentDateKey(dateOrKey);
  return new Date(`${key}T00:00:00.000Z`);
}

export type DateRangePreset = "today" | "yesterday" | "week" | "month" | "custom";

/** "YYYY-MM-DD" ni Toshkent kun boshiga (UTC Date) o'giradi. */
export function dateKeyToUtcStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return fromZonedTime(new Date(y, m - 1, d, 0, 0, 0, 0), TZ);
}
export function dateKeyToUtcEnd(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return fromZonedTime(new Date(y, m - 1, d, 23, 59, 59, 999), TZ);
}

/** Preset yoki custom oralig'idan {start,end} (UTC) hisoblaydi. */
export function presetRange(
  preset: DateRangePreset,
  from?: string,
  to?: string,
): { start: Date; end: Date; preset: DateRangePreset } {
  const now = new Date();
  switch (preset) {
    case "yesterday": {
      const r = tashkentDayRange(subDays(now, 1));
      return { ...r, preset };
    }
    case "week": {
      const start = tashkentDayRange(subDays(now, 6)).start;
      const end = tashkentDayRange(now).end;
      return { start, end, preset };
    }
    case "month": {
      const zoned = toZonedTime(now, TZ);
      const firstLocal = new Date(zoned.getFullYear(), zoned.getMonth(), 1, 0, 0, 0, 0);
      const start = fromZonedTime(firstLocal, TZ);
      const end = tashkentDayRange(now).end;
      return { start, end, preset };
    }
    case "custom": {
      if (from && to) {
        return { start: dateKeyToUtcStart(from), end: dateKeyToUtcEnd(to), preset };
      }
      const r = tashkentDayRange(now);
      return { ...r, preset: "today" };
    }
    case "today":
    default: {
      const r = tashkentDayRange(now);
      return { ...r, preset: "today" };
    }
  }
}
