import { prisma } from "@/lib/prisma";
import { tashkentDateKey } from "@/lib/datetime";
import { addDays } from "date-fns";

export interface ReportRow {
  date: string; // YYYY-MM-DD (Tashkent)
  adSpend: number;
  leads: number;
  sales: number;
  revenue: number;
  cpl: number; // adSpend / leads
  conversion: number; // sales / leads * 100
  cpa: number; // adSpend / sales
  roas: number; // revenue / adSpend
}

export interface ReportData {
  rows: ReportRow[];
  totals: Omit<ReportRow, "date">;
}

function metrics(adSpend: number, leads: number, sales: number, revenue: number) {
  return {
    cpl: leads > 0 ? adSpend / leads : 0,
    conversion: leads > 0 ? (sales / leads) * 100 : 0,
    cpa: sales > 0 ? adSpend / sales : 0,
    roas: adSpend > 0 ? revenue / adSpend : 0,
  };
}

/** Sana oralig'i uchun hisobot: kunlik reklama sarfi (qo'lda) + CRM ko'rsatkichlari. */
export async function getReportData(start: Date, end: Date): Promise<ReportData> {
  const [createdLeads, paidLeads, payments, reports] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: start, lte: end }, deletedAt: null },
      select: { createdAt: true },
    }),
    prisma.lead.findMany({
      where: { paidAt: { gte: start, lte: end }, deletedAt: null },
      select: { paidAt: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end } },
      select: { amount: true, paidAt: true },
    }),
    prisma.marketingReport.findMany({
      where: { date: { gte: start, lte: end } },
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
  const spendByDay = new Map<string, number>();
  for (const r of reports) {
    // @db.Date UTC sifatida saqlanadi — UTC kun kalitini olamiz
    const k = r.date.toISOString().slice(0, 10);
    spendByDay.set(k, Number(r.adSpend));
  }

  // Kunlarni oxirgisidan boshiga qarab hosil qilamiz
  const startKey = tashkentDateKey(start);
  const rows: ReportRow[] = [];
  let cursor = new Date(end);
  let guard = 0;
  while (guard < 400) {
    const k = tashkentDateKey(cursor);
    if (k < startKey) break;
    const adSpend = spendByDay.get(k) ?? 0;
    const leads = leadsByDay.get(k) ?? 0;
    const sales = salesByDay.get(k) ?? 0;
    const revenue = revenueByDay.get(k) ?? 0;
    rows.push({ date: k, adSpend, leads, sales, revenue, ...metrics(adSpend, leads, sales, revenue) });
    cursor = addDays(cursor, -1);
    guard++;
  }

  const totAdSpend = rows.reduce((s, r) => s + r.adSpend, 0);
  const totLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totSales = rows.reduce((s, r) => s + r.sales, 0);
  const totRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return {
    rows,
    totals: {
      adSpend: totAdSpend,
      leads: totLeads,
      sales: totSales,
      revenue: totRevenue,
      ...metrics(totAdSpend, totLeads, totSales, totRevenue),
    },
  };
}
