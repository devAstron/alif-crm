/**
 * Faqat SOTUVGA yo'naltirilgan (lead) reklama kampaniyalari Targetolog va
 * Hisobotlarga kiradi. Vakansiya, Instagram profil/qamrov (traffic/reach) kabi
 * boshqa maqsadli kampaniyalar sarfi hisobga olinmaydi.
 *
 * Qoida (katta-kichik harf va ortiqcha probellarga e'tibor berilmaydi):
 *  - nomida "arab tili" yoki "quallead" bo'lsa — qo'shiladi;
 *  - lekin nomida "vakansiya" bo'lsa — qo'shilmaydi (vakansiya kampaniyalari
 *    ham "Arab tili" deb nomlanadi).
 */
const INCLUDE_KEYWORDS = ["arab tili", "quallead"];
const EXCLUDE_KEYWORDS = ["vakansiya"];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isSalesCampaign(campaignName: string | null | undefined): boolean {
  if (!campaignName) return false;
  const n = normalize(campaignName);
  if (EXCLUDE_KEYWORDS.some((k) => n.includes(k))) return false;
  return INCLUDE_KEYWORDS.some((k) => n.includes(k));
}
