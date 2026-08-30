import { prisma } from "@/lib/prisma";
import { tashkentDateKey, tashkentDbDate } from "@/lib/datetime";
import { getUsdToUzsRate } from "@/lib/fx/rate";
import { getFbConfig, fetchFbInsights, type AdLevel } from "@/lib/facebook/marketing";

const LEVELS: AdLevel[] = ["campaign", "adset", "ad"];

export interface AdSyncResult {
  ok: boolean;
  date: string;
  usdToUzs?: number;
  rows?: number;
  fbLeadsTotal?: number;
  crmLeadsTotal?: number;
  error?: string;
}

/**
 * Berilgan kun (default: kecha) uchun Facebook insights'ni CRM'ga sinxronlaydi.
 * Sarfni AdInsight'ga yozadi, o'sha kundagi kursni snapshot qiladi va
 * FB lead soni bilan CRM lead sonini solishtiradi.
 */
export async function syncAdInsights(day: Date): Promise<AdSyncResult> {
  const dateKey = tashkentDateKey(day);
  const dbDate = tashkentDbDate(day);

  const cfg = await getFbConfig();
  if (!cfg) {
    return { ok: false, date: dateKey, error: "Facebook API sozlanmagan yoki o'chirilgan" };
  }

  try {
    const usdToUzs = await getUsdToUzsRate(day);

    let rowCount = 0;
    let fbLeadsTotal = 0;

    for (const level of LEVELS) {
      const insights = await fetchFbInsights(cfg, level, dateKey, dateKey);
      for (const row of insights) {
        if (level === "campaign") fbLeadsTotal += row.fbLeads;
        await prisma.adInsight.upsert({
          where: { date_level_entityId: { date: dbDate, level, entityId: row.entityId } },
          create: {
            date: dbDate,
            level,
            entityId: row.entityId,
            entityName: row.entityName,
            spendUsd: row.spendUsd,
            impressions: row.impressions,
            clicks: row.clicks,
            fbLeads: row.fbLeads,
            usdToUzs,
          },
          update: {
            entityName: row.entityName,
            spendUsd: row.spendUsd,
            impressions: row.impressions,
            clicks: row.clicks,
            fbLeads: row.fbLeads,
            usdToUzs,
          },
        });
        rowCount++;
      }
    }

    // CRM lead soni (o'sha kun, Toshkent) — FB bilan solishtirish uchun
    const { start, end } = dayBounds(dateKey);
    const crmLeadsTotal = await prisma.lead.count({
      where: { createdAt: { gte: start, lte: end }, deletedAt: null },
    });

    await prisma.fbSettings.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    return { ok: true, date: dateKey, usdToUzs, rows: rowCount, fbLeadsTotal, crmLeadsTotal };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Sinxronlashda xatolik";
    await prisma.fbSettings.update({ where: { id: "singleton" }, data: { lastSyncError: error } }).catch(() => {});
    return { ok: false, date: dateKey, error };
  }
}

function dayBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateKey}T00:00:00.000+05:00`),
    end: new Date(`${dateKey}T23:59:59.999+05:00`),
  };
}
