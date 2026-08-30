/** Client-safe formatlash yordamchilari. */

const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  instagram_direct: "Instagram Direct",
  website: "Veb-sayt",
  target: "Target",
  telegram: "Telegram",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
}

/** Telefonni tel: uchun tozalash. */
export function telHref(phone: string): string {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

/** Telegram havolasi (raqam yoki username orqali). */
export function telegramHref(phone: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://t.me/+${clean}`;
}

export function genderLabel(g: string | null | undefined): string {
  if (g === "MALE") return "Erkak";
  if (g === "FEMALE") return "Ayol";
  return "—";
}

const INQUIRY_LABELS: Record<string, string> = {
  TARGET: "Target",
  INSTAGRAM_DIRECT: "Instagram Direct",
  INSTAGRAM_COMMENT: "Instagram komment",
  REFERRAL: "Tanishidan eshitib",
  OTHER: "Boshqa",
};

export function inquirySourceLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return INQUIRY_LABELS[s] ?? s;
}
