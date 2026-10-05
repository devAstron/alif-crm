import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { isSalesCampaign } from "@/lib/facebook/campaign-filter";

export type AdLevel = "campaign" | "adset" | "ad";

export interface FbInsightRow {
  level: AdLevel;
  entityId: string;
  entityName: string | null;
  spendUsd: number; // sent (butun) — USD * 100
  impressions: number;
  clicks: number;
  fbLeads: number;
  // Ierarxiya (drill-down uchun): adset/ad qaysi kampaniya/adsetга tegishli
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
}

interface FbConfig {
  adAccountId: string;
  accessToken: string;
  apiVersion: string;
}

/**
 * FbSettings'ni o'qib, tokenni ochadi. Ad account/token bo'lmasa null.
 * requireEnabled=true (default) — "Yoqilgan" belgilanmagan bo'lsa ham null
 * (kunlik sinxron uchun). Ulanishni tekshirishda requireEnabled=false beriladi.
 */
export async function getFbConfig(opts: { requireEnabled?: boolean } = {}): Promise<FbConfig | null> {
  const { requireEnabled = true } = opts;
  const s = await prisma.fbSettings.findUnique({ where: { id: "singleton" } });
  if (!s || !s.adAccountId || !s.accessTokenEnc) return null;
  if (requireEnabled && !s.enabled) return null;
  const accessToken = decryptSecret(s.accessTokenEnc);
  if (!accessToken) return null;
  return { adAccountId: s.adAccountId, accessToken, apiVersion: s.apiVersion };
}

const LEVEL_ID_FIELD: Record<AdLevel, string> = {
  campaign: "campaign_id",
  adset: "adset_id",
  ad: "ad_id",
};
const LEVEL_NAME_FIELD: Record<AdLevel, string> = {
  campaign: "campaign_name",
  adset: "adset_name",
  ad: "ad_name",
};
// Har level uchun so'raladigan maydonlar (parent id/name bilan — ierarxiya uchun)
const LEVEL_FIELDS: Record<AdLevel, string> = {
  campaign: "campaign_id,campaign_name",
  adset: "adset_id,adset_name,campaign_id,campaign_name",
  ad: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name",
};

/**
 * Lead action turlari — MUHIM: Meta bitta leadni bir necha nom ostida qaytaradi
 * (`lead`, `onsite_conversion.lead_grouped`, `offsite_*_add_meta_leads` — hammasi
 * bir xil sonni beradi). Shuning uchun ularni QO'SHMAYMIZ, balki ustuvorlik
 * bo'yicha BITTASINI olamiz. `lead` — Meta'ning yagona jamlangan ko'rsatkichi.
 */
const LEAD_ACTION_PRIORITY = [
  "lead",
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
  "offsite_complete_registration_add_meta_leads",
  "offsite_conversion.fb_pixel_lead",
];

/**
 * Ad account insights'ni berilgan sana oralig'i uchun oladi (level kesimida).
 * since/until — "YYYY-MM-DD" (Toshkent kuni). Sarf USD sentda qaytadi.
 * Faqat sotuv (lead) kampaniyalari qaytariladi (campaign-filter.ts) — adset/ad
 * qatorlari ham o'z kampaniyasi nomi bo'yicha saralanadi.
 */
export async function fetchFbInsights(
  cfg: FbConfig,
  level: AdLevel,
  since: string,
  until: string,
): Promise<FbInsightRow[]> {
  const idField = LEVEL_ID_FIELD[level];
  const nameField = LEVEL_NAME_FIELD[level];
  const params = new URLSearchParams({
    level,
    fields: `${LEVEL_FIELDS[level]},spend,impressions,clicks,actions`,
    time_range: JSON.stringify({ since, until }),
    time_increment: "all_days",
    limit: "500",
    access_token: cfg.accessToken,
  });

  const rows: FbInsightRow[] = [];
  let url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.adAccountId}/insights?${params.toString()}`;

  // Sahifalash (paging.next)
  for (let page = 0; page < 20 && url; page++) {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as {
      data?: FbInsightApiRow[];
      paging?: { next?: string };
      error?: { message?: string; code?: number };
    };
    if (json.error) {
      throw new Error(`Facebook API xatosi: ${json.error.message ?? "noma'lum"} (${json.error.code ?? "?"})`);
    }
    for (const r of json.data ?? []) {
      rows.push({
        level,
        entityId: String(r[idField] ?? ""),
        entityName: (r[nameField] as string) ?? null,
        spendUsd: Math.round(Number(r.spend ?? 0) * 100),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        fbLeads: extractLeadCount(r.actions),
        campaignId: r.campaign_id ? String(r.campaign_id) : null,
        campaignName: (r.campaign_name as string) ?? null,
        adsetId: r.adset_id ? String(r.adset_id) : null,
        adsetName: (r.adset_name as string) ?? null,
      });
    }
    url = json.paging?.next ?? "";
  }

  return rows.filter((r) => r.entityId && isSalesCampaign(r.campaignName));
}

interface FbInsightApiRow {
  [key: string]: unknown;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

function extractLeadCount(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const byType = new Map(actions.map((a) => [a.action_type, Number(a.value ?? 0)]));
  for (const type of LEAD_ACTION_PRIORITY) {
    const v = byType.get(type);
    if (v !== undefined) return v;
  }
  return 0;
}
