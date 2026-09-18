import { prisma } from "@/lib/prisma";
import { tashkentDateKey, tashkentDbDate } from "@/lib/datetime";
import { getUsdToUzsRate } from "@/lib/fx/rate";
import { addDays } from "date-fns";

export interface ReportRow {
  date: string; // YYYY-MM-DD (Tashkent)
  adSpendUsd: number; // sent (USD*100) — Facebook'dan (AdInsight), zaxira: eski qo'lda kiritilgan so'm
  leads: number;
  sales: number;
  revenue: number; // so'm
  cpl: number; // adSpendUsd / leads ($)
  conversion: number; // sales / leads * 100
  cpa: number; // adSpendUsd / sales ($)
  roas: number; // revenue(so'm) / adSpend(so'm-ekvivalenti)
}

export interface ReportData {
  rows: ReportRow[];
  totals: Omit<ReportRow, "date">;
}

function metrics(adSpendUsd: number, adSpendUzs: number, leads: number, sales: number, revenue: number) {
  return {
    cpl: leads > 0 ? adSpendUsd / leads : 0,
    conversion: leads > 0 ? (sales / leads) * 100 : 0,
    cpa: sales > 0 ? adSpendUsd / sales : 0,
    roas: adSpendUzs > 0 ? revenue / adSpendUzs : 0,
  };
}

/**
 * Sana oralig'i uchun hisobot: kunlik reklama sarfi (Facebook'dan, $) + CRM ko'rsatkichlari.
 * Sarf manbasi: AdInsight (kampaniya darajasi, kunlik avtomatik sinxron/qo'lda "Kechani
 * hisoblash"). Agar o'sha kun uchun AdInsight bo'lmasa — eski MarketingReport (so'm, qo'lda
 * kiritilgan) zaxira sifatida ishlatiladi, kurs bilan $ ga o'giriladi.
 */
export async function getReportData(start: Date, end: Date): Promise<ReportData> {
  const [createdLeads, paidLeads, payments, insights, reports] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: start, lte: end }, deletedAt: null },
      select: { createdAt: true },
    }),
    prisma.lead.findMany({
      where: { paidAt: { gte: start, lte: end }, deletedAt: null },
      select: { paidAt: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end }, lead: { deletedAt: null } },
      select: { amount: true, paidAt: true },
    }),
    prisma.adInsight.findMany({
      where: { level: "campaign", date: { gte: tashkentDbDate(start), lte: tashkentDbDate(end) } },
      select: { date: true, spendUsd: true, usdToUzs: true },
    }),
    prisma.marketingReport.findMany({
      where: { date: { gte: tashkentDbDate(start), lte: tashkentDbDate(end) } },
      select: { date: true, adSpend: true },
    }),
  ]);

  // Kun bo'yicha guruhlash (Toshkent)
  const leadsByDay = new Map<string, number>();
  for (const l of createdLeads) {
    const k = tashkentDateKey(l.createdAt);
    leadsByDay.set(k, (leadsByDay.get(k) ?? 0) + 1);
  }
  const salesByDay = new Map<string, number>();
  for (const l of paidLeads) {
    if (!l.paidAt) continue;
    const k = tashkentDateKey(l.paidAt);
    salesByDay.set(k, (salesByDay.get(k) ?? 0) + 1);
  }
  const revenueByDay = new Map<string, number>();
  for (const p of payments) {
    const k = tashkentDateKey(p.paidAt);
    revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + Number(p.amount));
  }

  // Facebook'dan (AdInsight, kampaniya darajasi) — asosiy manba
  const spendUsdByDay = new Map<string, number>();
  const rateByDay = new Map<string, number>();
  for (const i of insights) {
    const k = i.date.toISOString().slice(0, 10);
    spendUsdByDay.set(k, (spendUsdByDay.get(k) ?? 0) + i.spendUsd);
    if (!rateByDay.has(k)) rateByDay.set(k, i.usdToUzs);
  }
  // Eski qo'lda kiritilgan (so'm) — faqat AdInsight bo'lmagan kunlar uchun zaxira
  const legacySomByDay = new Map<string, number>();
  for (const r of reports) {
    const k = r.date.toISOString().slice(0, 10);
    if (!spendUsdByDay.has(k)) legacySomByDay.set(k, Number(r.adSpend));
  }

  // Kunlarni oxirgisidan boshiga qarab hosil qilamiz
  const startKey = tashkentDateKey(start);
  const rows: ReportRow[] = [];
  let cursor = new Date(end);
  let guard = 0;
  while (guard < 400) {
    const k = tashkentDateKey(cursor);
    if (k < startKey) break;

    let adSpendUsd = spendUsdByDay.get(k) ?? 0;
    let adSpendUzs: number;
    if (spendUsdByDay.has(k)) {
      const rate = rateByDay.get(k) ?? (await getUsdToUzsRate(cursor));
      adSpendUzs = Math.round((adSpendUsd / 100) * rate);
    } else if (legacySomByDay.has(k)) {
      adSpendUzs = legacySomByDay.get(k)!;
      const rate = await getUsdToUzsRate(cursor);
      adSpendUsd = rate > 0 ? Math.round((adSpendUzs / rate) * 100) : 0;
    } else {
      adSpendUzs = 0;
    }

    const leads = leadsByDay.get(k) ?? 0;
    const sales = salesByDay.get(k) ?? 0;
    const revenue = revenueByDay.get(k) ?? 0;
    rows.push({ date: k, adSpendUsd, leads, sales, revenue, ...metrics(adSpendUsd, adSpendUzs, leads, sales, revenue) });
    cursor = addDays(cursor, -1);
    guard++;
  }

  const totAdSpendUsd = rows.reduce((s, r) => s + r.adSpendUsd, 0);
  const totLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totSales = rows.reduce((s, r) => s + r.sales, 0);
  const totRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  // Jami ROAS uchun taxminiy so'm-ekvivalent (kunlik sarflarning yig'indisi)
  const totAdSpendUzs = rows.reduce((s, r) => s + (r.roas > 0 ? r.revenue / r.roas : 0), 0);

  return {
    rows,
    totals: {
      adSpendUsd: totAdSpendUsd,
      leads: totLeads,
      sales: totSales,
      revenue: totRevenue,
      ...metrics(totAdSpendUsd, totAdSpendUzs, totLeads, totSales, totRevenue),
    },
  };
}
