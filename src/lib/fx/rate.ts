import { prisma } from "@/lib/prisma";
import { tashkentDbDate } from "@/lib/datetime";

const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/";
const FALLBACK_RATE = 12600; // Agar CBU javob bermasa — taxminiy zaxira kurs

/**
 * Berilgan kun uchun USD→UZS kursini qaytaradi (so'm/USD, butun).
 * Avval bazadan (FxRate) qidiradi, bo'lmasa CBU'dan olib keshlaydi.
 */
export async function getUsdToUzsRate(day: Date = new Date()): Promise<number> {
  const date = tashkentDbDate(day);

  const cached = await prisma.fxRate.findUnique({ where: { date } });
  if (cached) return cached.usdToUzs;

  const rate = await fetchCbuUsdRate();
  const value = rate ?? (await latestKnownRate()) ?? FALLBACK_RATE;

  // Faqat CBU'dan haqiqiy kurs olingan bo'lsa keshlaymiz
  if (rate) {
    await prisma.fxRate.upsert({
      where: { date },
      create: { date, usdToUzs: value, source: "cbu" },
      update: { usdToUzs: value },
    });
  }

  return value;
}

/** CBU'dan joriy USD kursini oladi (butun so'm), xato bo'lsa null. */
async function fetchCbuUsdRate(): Promise<number | null> {
  try {
    const res = await fetch(CBU_URL, {
      headers: { Accept: "application/json" },
      // CBU kuniga bir marta yangilanadi
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ Ccy?: string; Rate?: string }>;
    const usd = Array.isArray(data) ? data.find((d) => d.Ccy === "USD") : null;
    const parsed = usd?.Rate ? Number(usd.Rate) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  } catch {
    return null;
  }
}

/** Bazadagi eng so'nggi ma'lum kurs (zaxira). */
async function latestKnownRate(): Promise<number | null> {
  const last = await prisma.fxRate.findFirst({ orderBy: { date: "desc" } });
  return last?.usdToUzs ?? null;
}
