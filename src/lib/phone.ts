/**
 * O'zbekiston telefon raqamlarini E.164 (+998XXXXXXXXX) formatiga keltiradi.
 * Turli formatlarni qabul qiladi: "950049559", "91 725 55 98", "77.0400825",
 * "+998...", "998...". Normallashtira olmasa — tozalangan asl qiymatni qaytaradi.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw.trim();

  // 998 + 9 raqam (jami 12) → to'liq
  if (digits.length === 12 && digits.startsWith("998")) return "+" + digits;
  // 9 raqam (faqat mahalliy) → +998 qo'shamiz
  if (digits.length === 9) return "+998" + digits;
  // 8XXXXXXXXX (10 raqam, 8 bilan boshlansa — noaniq, o'zbekcha emas) — o'zgartirmaymiz
  // 00998... yoki boshqa xalqaro
  if (digits.length === 14 && digits.startsWith("00998")) return "+" + digits.slice(2);
  // Boshqa hollar: agar 998 bilan boshlansa "+" qo'shamiz, aks holda tozalangan holicha
  if (digits.startsWith("998")) return "+" + digits;
  return raw.trim();
}
