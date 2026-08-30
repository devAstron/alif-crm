import { prisma } from "@/lib/prisma";
import { tashkentDbDate, tashkentDateKey } from "@/lib/datetime";
import { getUsdToUzsRate } from "@/lib/fx/rate";
import { getFbConfig, fetchFbInsights, type AdLevel } from "@/lib/facebook/marketing";

export interface AdStatRow {
  key: string; // entity id
  name: string;
  campaignId: string | null; // parent kampaniya (adset/ad qatorlari uchun)
  adsetId: string | null; // parent adset (ad qatorlari uchun)
  leads: number;
  qualified: number;
  sales: number;
  revenue: number; // so'm
  conversion: number; // sales/leads*100
  fbLeads: number; // Facebook hisoblagan lead
  spendUsd: number; // sent (USD*100)
  spendUzs: number; // so'm
  cpl: number; // so'm / lead (CRM lead bo'yicha)
  cpa: number; // so'm / sotuv
  roas: number; // tushum / sarf (so'm bo'yicha)
}

export interface CampaignStats {
  campaigns: AdStatRow[];
  adsets: AdStatRow[];
  ads: AdStatRow[];
  hasSpendData: boolean; // Facebook sarf ma'lumoti mavjudmi
  live: boolean; // sarf jonli FB'dan olindimi (aks holda AdInsight zaxirasi)
}

interface SpendAgg {
  name: string | null;
  spendUsd: number;
  spendUzs: number;
  fbLeads: number;
  campaignId: string | null;
  adsetId: string | null;
}

type SpendMaps = Record<AdLevel, Map<string, SpendAgg>>;

/**
 * Kampaniya / ad set / ad kesimida CRM ko'rsatkichlari (lead, sifatli, sotuv, tushum)
 * va Facebook reklama sarfi (CPL/CPA/ROAS). Sarf tanlangan sana oralig'i uchun
 * JONLI Facebook Marketing API'dan olinadi (bugun ham real vaqt). FB sozlanmagan
 * yoki xato bo'lsa — AdInsight (kunlik snapshot) zaxirasidan foydalanadi.
 * Ierarxiya (drill-down) uchun har adset/ad o'z parent kampaniya/adsetini biladi.
 */
export async function getCampaignStats(start: Date, end: Date): Promise<CampaignStats> {
  const rangeWhere = { createdAt: { gte: start, lte: end }, deletedAt: null };

  const [leads, payments] = await Promise.all([
    prisma.lead.findMany({
      where: rangeWhere,
      select: {
        id: true,
        campaignId: true, campaignName: true,
        adsetId: true, adsetName: true,
        adId: true, adName: true,
        qualifiedAt: true, paidAt: true,
      },
    }),
    prisma.payment.groupBy({
      by: ["leadId"],
      where: { paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ]);
  const revByLead = new Map(payments.map((p) => [p.leadId, Number(p._sum.amount ?? 0n)]));

  const spend: SpendMaps = { campaign: new Map(), adset: new Map(), ad: new Map() };
  let hasSpendData = false;
  let live = false;

  // 1) Jonli Facebook (tanlangan oraliq uchun)
  const cfg = await getFbConfig({ requireEnabled: false });
  if (cfg) {
    try {
      const usdToUzs = await getUsdToUzsRate();
      const since = tashkentDateKey(start);
      const until = tashkentDateKey(end);
      const [c, a, d] = await Promise.all([
        fetchFbInsights(cfg, "campaign", since, until),
        fetchFbInsights(cfg, "adset", since, until),
        fetchFbInsights(cfg, "ad", since, until),
      ]);
      for (const r of [...c, ...a, ...d]) {
        spend[r.level].set(r.entityId, {
          name: r.entityName,
          spendUsd: r.spendUsd,
          spendUzs: Math.round((r.spendUsd / 100) * usdToUzs),
          fbLeads: r.fbLeads,
          campaignId: r.campaignId,
          adsetId: r.adsetId,
        });
      }
      hasSpendData = c.length + a.length + d.length > 0;
      live = true;
    } catch {
      // Jonli olish muvaffaqiyatsiz — pastda AdInsight zaxirasiga o'tamiz
      live = false;
    }
  }

  // 2) Zaxira: AdInsight (kunlik snapshot) — jonli bo'lmasa
  if (!hasSpendData) {
    const insights = await prisma.adInsight.findMany({
      where: { date: { gte: tashkentDbDate(start), lte: tashkentDbDate(end) } },
      select: { level: true, entityId: true, entityName: true, spendUsd: true, usdToUzs: true, fbLeads: true },
    });
    for (const i of insights) {
      const m = spend[i.level as AdLevel];
      if (!m) continue;
      let agg = m.get(i.entityId);
      if (!agg) { agg = { name: i.entityName, spendUsd: 0, spendUzs: 0, fbLeads: 0, campaignId: null, adsetId: null }; m.set(i.entityId, agg); }
      if (!agg.name && i.entityName) agg.name = i.entityName;
      agg.spendUsd += i.spendUsd;
      agg.spendUzs += Math.round((i.spendUsd / 100) * i.usdToUzs);
      agg.fbLeads += i.fbLeads;
    }
    hasSpendData = insights.length > 0;
  }

  function newRow(key: string, name: string): AdStatRow {
    return { key, name, campaignId: null, adsetId: null, leads: 0, qualified: 0, sales: 0, revenue: 0, conversion: 0, fbLeads: 0, spendUsd: 0, spendUzs: 0, cpl: 0, cpa: 0, roas: 0 };
  }

  function build(
    level: AdLevel,
    idOf: (l: (typeof leads)[number]) => string | null,
    nameOf: (l: (typeof leads)[number]) => string | null,
    parentCampaign: (l: (typeof leads)[number]) => string | null,
    parentAdset: (l: (typeof leads)[number]) => string | null,
  ): AdStatRow[] {
    const map = new Map<string, AdStatRow>();

    // CRM leadlaridan: metrikalar + parent (ierarxiya)
    for (const l of leads) {
      const id = idOf(l);
      if (!id) continue;
      let row = map.get(id);
      if (!row) { row = newRow(id, nameOf(l) ?? id); map.set(id, row); }
      row.leads += 1;
      if (l.qualifiedAt) row.qualified += 1;
      if (l.paidAt) row.sales += 1;
      row.revenue += revByLead.get(l.id) ?? 0;
      const pc = parentCampaign(l);
      const pa = parentAdset(l);
      if (pc && !row.campaignId) row.campaignId = pc;
      if (pa && !row.adsetId) row.adsetId = pa;
    }

    // Sarf (FB/AdInsight)dan: sarf + parent + nom
    for (const [id, s] of spend[level]) {
      let row = map.get(id);
      if (!row) { row = newRow(id, s.name ?? id); map.set(id, row); }
      row.spendUsd = s.spendUsd;
      row.spendUzs = s.spendUzs;
      row.fbLeads = s.fbLeads;
      if (s.campaignId && !row.campaignId) row.campaignId = s.campaignId;
      if (s.adsetId && !row.adsetId) row.adsetId = s.adsetId;
      if ((!row.name || row.name === id) && s.name) row.name = s.name;
    }

    for (const r of map.values()) {
      r.conversion = r.leads > 0 ? (r.sales / r.leads) * 100 : 0;
      r.cpl = r.leads > 0 ? Math.round(r.spendUzs / r.leads) : 0;
      r.cpa = r.sales > 0 ? Math.round(r.spendUzs / r.sales) : 0;
      r.roas = r.spendUzs > 0 ? r.revenue / r.spendUzs : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.spendUzs - a.spendUzs || b.leads - a.leads);
  }

  return {
    campaigns: build("campaign", (l) => l.campaignId, (l) => l.campaignName, (l) => l.campaignId, () => null),
    adsets: build("adset", (l) => l.adsetId, (l) => l.adsetName, (l) => l.campaignId, () => null),
    ads: build("ad", (l) => l.adId, (l) => l.adName, (l) => l.campaignId, (l) => l.adsetId),
    hasSpendData,
    live,
  };
}
