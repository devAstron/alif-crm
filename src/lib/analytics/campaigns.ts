import { prisma } from "@/lib/prisma";
import { tashkentDbDate } from "@/lib/datetime";

export interface AdStatRow {
  key: string; // id yoki nom
  name: string;
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
}

interface SpendAgg {
  name: string | null;
  spendUsd: number;
  spendUzs: number;
  fbLeads: number;
}

/**
 * Kampaniya / ad set / ad kesimida CRM ko'rsatkichlari (leadlar, sifatli, sotuv, tushum)
 * va Facebook'dan olingan reklama sarfi (CPL/CPA/ROAS). Sarf USD'da kiritiladi,
 * o'sha kundagi kurs bo'yicha so'mga o'giriladi (AdInsight snapshot).
 */
export async function getCampaignStats(start: Date, end: Date): Promise<CampaignStats> {
  const rangeWhere = { createdAt: { gte: start, lte: end }, deletedAt: null };
  const dbStart = tashkentDbDate(start);
  const dbEnd = tashkentDbDate(end);

  const [leads, payments, insights] = await Promise.all([
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
    prisma.adInsight.findMany({
      where: { date: { gte: dbStart, lte: dbEnd } },
      select: { level: true, entityId: true, entityName: true, spendUsd: true, usdToUzs: true, fbLeads: true },
    }),
  ]);

  const revByLead = new Map(payments.map((p) => [p.leadId, Number(p._sum.amount ?? 0n)]));

  // Sarfni level+entity bo'yicha jamlash (kunlik kurs snapshot bilan so'mga)
  const spendByKey = new Map<string, SpendAgg>();
  for (const i of insights) {
    const k = `${i.level}:${i.entityId}`;
    let agg = spendByKey.get(k);
    if (!agg) { agg = { name: i.entityName, spendUsd: 0, spendUzs: 0, fbLeads: 0 }; spendByKey.set(k, agg); }
    if (!agg.name && i.entityName) agg.name = i.entityName;
    agg.spendUsd += i.spendUsd;
    agg.spendUzs += Math.round((i.spendUsd / 100) * i.usdToUzs);
    agg.fbLeads += i.fbLeads;
  }
  const hasSpendData = insights.length > 0;

  function aggregate(
    level: "campaign" | "adset" | "ad",
    idOf: (l: (typeof leads)[number]) => string | null,
    nameOf: (l: (typeof leads)[number]) => string | null,
  ): AdStatRow[] {
    const map = new Map<string, AdStatRow>();
    for (const l of leads) {
      const id = idOf(l);
      const name = nameOf(l) ?? id ?? "—";
      const key = id ?? name ?? "unknown";
      if (!key || key === "unknown") continue;
      let row = map.get(key);
      if (!row) {
        row = { key, name, leads: 0, qualified: 0, sales: 0, revenue: 0, conversion: 0, fbLeads: 0, spendUsd: 0, spendUzs: 0, cpl: 0, cpa: 0, roas: 0 };
        map.set(key, row);
      }
      row.leads += 1;
      if (l.qualifiedAt) row.qualified += 1;
      if (l.paidAt) row.sales += 1;
      row.revenue += revByLead.get(l.id) ?? 0;
    }

    const rows = Array.from(map.values());
    for (const r of rows) {
      const spend = spendByKey.get(`${level}:${r.key}`);
      if (spend) {
        r.spendUsd = spend.spendUsd;
        r.spendUzs = spend.spendUzs;
        r.fbLeads = spend.fbLeads;
      }
      r.conversion = r.leads > 0 ? (r.sales / r.leads) * 100 : 0;
      r.cpl = r.leads > 0 ? Math.round(r.spendUzs / r.leads) : 0;
      r.cpa = r.sales > 0 ? Math.round(r.spendUzs / r.sales) : 0;
      r.roas = r.spendUzs > 0 ? r.revenue / r.spendUzs : 0;
    }

    // Sarfi bor entitilar ham (lead kelmagan bo'lsa ham) ko'rinishi uchun qo'shamiz
    for (const [k, spend] of spendByKey) {
      const [lvl, entityId] = k.split(/:(.+)/);
      if (lvl !== level || map.has(entityId)) continue;
      map.set(entityId, {
        key: entityId, name: spend.name ?? entityId, leads: 0, qualified: 0, sales: 0, revenue: 0,
        conversion: 0, fbLeads: spend.fbLeads, spendUsd: spend.spendUsd, spendUzs: spend.spendUzs,
        cpl: 0, cpa: 0, roas: 0,
      });
    }

    return Array.from(map.values()).sort((a, b) => b.leads - a.leads || b.spendUzs - a.spendUzs);
  }

  return {
    campaigns: aggregate("campaign", (l) => l.campaignId, (l) => l.campaignName),
    adsets: aggregate("adset", (l) => l.adsetId, (l) => l.adsetName),
    ads: aggregate("ad", (l) => l.adId, (l) => l.adName),
    hasSpendData,
  };
}
