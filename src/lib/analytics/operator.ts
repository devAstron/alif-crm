import { prisma } from "@/lib/prisma";
import { getDefaultPipeline } from "@/lib/pipeline";
import { STAGE } from "@/lib/constants";
import { tashkentDateKey } from "@/lib/datetime";
import { addDays } from "date-fns";
import type { Prisma } from "@prisma/client";

export interface OperatorDashboard {
  assignedTotal: number;
  byStage: Record<string, number>;
  qualifiedCount: number;
  salesCount: number;
  revenue: number;
  conversion: number;
  funnel: { slug: string; name: string; count: number; color: string }[];
  stageDistribution: { name: string; count: number; color: string }[];
  daily: { date: string; label: string; leads: number; sales: number }[];
}

/**
 * Operator dashboard: operatorGA SHU DAVRDA BIRIKTIRILGAN leadlar bo'yicha
 * (assignedAt oralig'ida) — operatorning faoliyatini aks ettiradi.
 * Sana filtri operator BUGUN qilgan biriktirishlarni darhol ko'rsatadi.
 */
export async function getOperatorDashboardData(
  operatorId: string,
  start: Date,
  end: Date,
): Promise<OperatorDashboard> {
  const pipeline = await getDefaultPipeline();
  const stageById = new Map(pipeline.stages.map((s) => [s.id, s]));

  // "Kogorta" = shu davrda operatorga biriktirilgan leadlar (faqat "Biriktirilgan
  // leadlar" KPI kartasi uchun — yangi biriktirishlar oqimi).
  const cohort: Prisma.LeadWhereInput = {
    assignedToId: operatorId,
    assignedAt: { gte: start, lte: end },
    deletedAt: null,
  };
  // Sotuv/tushum — SOTUV KUNI (paidAt) bo'yicha, biriktirilgan kunga emas.
  // Lead 28-kuni tushib 31-kuni sotilsa, sotuv 31-kunga yoziladi (hisob-kitob to'g'ri).
  const salesScope: Prisma.LeadWhereInput = {
    assignedToId: operatorId,
    paidAt: { gte: start, lte: end },
    deletedAt: null,
  };
  // Bosqich faoliyati (funnel/byStage) — HARAKAT SODIR BO'LGAN kun bo'yicha
  // (stageChangedAt), lead qачon biriktirilganidan qat'i nazar. Masalan lead
  // 5 kun oldin biriktirilib, bugun "To'lov qildi"ga o'tsa — bugungi
  // voronkada ko'rinadi (createdAt/assignedAt-kogorta bo'yicha bo'lsa,
  // bugun ko'rinmas edi — aynan shu xato bor edi).
  const stageActivityScope: Prisma.LeadWhereInput = {
    assignedToId: operatorId,
    stageChangedAt: { gte: start, lte: end },
    deletedAt: null,
  };
  // Sifatli lid — qualifiedAt shu davrda bo'lsa, biriktirilgan kunidan qat'i nazar
  const qualifiedScope: Prisma.LeadWhereInput = {
    assignedToId: operatorId,
    qualifiedAt: { gte: start, lte: end },
    deletedAt: null,
  };

  const [byStageRaw, assignedTotal, qualifiedCount, salesCount, revenueAgg, assignedLeads, paidLeads] =
    await Promise.all([
      prisma.lead.groupBy({ by: ["stageId"], where: stageActivityScope, _count: { _all: true } }),
      prisma.lead.count({ where: cohort }),
      prisma.lead.count({ where: qualifiedScope }),
      prisma.lead.count({ where: salesScope }),
      prisma.payment.aggregate({ where: { paidAt: { gte: start, lte: end }, lead: { assignedToId: operatorId } }, _sum: { amount: true } }),
      prisma.lead.findMany({ where: cohort, select: { assignedAt: true } }),
      prisma.lead.findMany({ where: salesScope, select: { paidAt: true } }),
    ]);

  const byStage: Record<string, number> = {};
  for (const s of pipeline.stages) byStage[s.slug] = 0;
  for (const row of byStageRaw) {
    const st = stageById.get(row.stageId);
    if (st) byStage[st.slug] = row._count._all;
  }

  const conversion = assignedTotal > 0 ? (salesCount / assignedTotal) * 100 : 0;

  // Funnel/stageDistribution — shu davrda bosqichi o'zgargan (stageChangedAt)
  // leadlar, Kanban'ning joriy holati emas (yuqoridagi stageActivityScope).
  const funnel = pipeline.stages
    .filter((s) => s.slug !== STAGE.REJECTED)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ slug: s.slug, name: s.name, count: byStage[s.slug] ?? 0, color: s.color }));

  const stageDistribution = pipeline.stages
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ name: s.name, count: byStage[s.slug] ?? 0, color: s.color }))
    .filter((s) => s.count > 0);

  // Kunlik trend (Toshkent): biriktirilgan kun bo'yicha leadlar, to'langan kun bo'yicha sotuvlar
  const leadsByDay = new Map<string, number>();
  for (const l of assignedLeads) {
    if (!l.assignedAt) continue;
    const k = tashkentDateKey(l.assignedAt);
    leadsByDay.set(k, (leadsByDay.get(k) ?? 0) + 1);
  }
  const salesByDay = new Map<string, number>();
  for (const l of paidLeads) {
    if (!l.paidAt) continue;
    const k = tashkentDateKey(l.paidAt);
    salesByDay.set(k, (salesByDay.get(k) ?? 0) + 1);
  }

  const daily: OperatorDashboard["daily"] = [];
  const endKey = tashkentDateKey(end);
  let cursor = new Date(start);
  let guard = 0;
  while (guard < 400) {
    const k = tashkentDateKey(cursor);
    if (k > endKey) break;
    daily.push({
      date: k,
      label: k.slice(8) + "." + k.slice(5, 7),
      leads: leadsByDay.get(k) ?? 0,
      sales: salesByDay.get(k) ?? 0,
    });
    cursor = addDays(cursor, 1);
    guard++;
  }

  return {
    assignedTotal,
    byStage,
    qualifiedCount,
    salesCount,
    revenue: Number(revenueAgg._sum.amount ?? 0n),
    conversion,
    funnel,
    stageDistribution,
    daily,
  };
}
