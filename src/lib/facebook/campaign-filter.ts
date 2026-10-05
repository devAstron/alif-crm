/**
 * Faqat SOTUVGA yo'naltirilgan (lead) reklama kampaniyalari Targetolog va
 * Hisobotlarga kiradi. Vakansiya, Instagram post qamrovi (reach/traffic) kabi
 * boshqa maqsadli kampaniyalar sarfi hisobga olinmaydi.
 *
 * Ajratish qoidasi: kampaniya nomida quyidagi iboralardan biri bo'lsa
 * (katta-kichik harf va ortiqcha probellarga e'tibor berilmaydi).
 */
const SALES_CAMPAIGN_KEYWORDS = ["alif arab tili", "quallead"];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isSalesCampaign(campaignName: string | null | undefined): boolean {
  if (!campaignName) return false;
  const n = normalize(campaignName);
  return SALES_CAMPAIGN_KEYWORDS.some((k) => n.includes(k));
}
