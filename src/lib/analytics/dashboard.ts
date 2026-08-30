import { prisma } from "@/lib/prisma";
import { getDefaultPipeline } from "@/lib/pipeline";
import { STAGE } from "@/lib/constants";

export interface DashboardData {
  leadsTotal: number;
  byStage: Record<string, number>; // slug -> count (range leadlari, joriy bosqich)
  qualifiedCount: number; // sifatli lid (qualifiedAt belgilangan)
  salesCount: number;
  revenue: number;
  fullPaymentSum: number;
  partialPaymentSum: number;
  conversion: number;
  funnel: { slug: string; name: string; count: number }[];
  operators: OperatorStat[];
}

export interface OperatorStat {
  id: string;
  name: string;
  assigned: number;
  qualified: number;
  rejected: number;
  paymentPending: number;
  partial: number;
  sales: number;
  conversion: number;
}

/** Dashboard uchun barcha ko'rsatkichlar (sana oralig'i UTC). */
export async function getDashboardData(start: Date, end: Date): Promise<DashboardData> {
  const pipeline = await getDefaultPipeline();
  const stageById = new Map(pipeline.stages.map((s) => [s.id, s]));

  const rangeWhere = { createdAt: { gte: start, lte: end }, deletedAt: null };

  const [
    byStageRaw,
    leadsTotal,
    qualifiedCount,
    qualifiedByOp,
    salesCount,
    revenueAgg,
    fullAgg,
    partialAgg,
    opRaw,
    operators,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ["stageId"], where: rangeWhere, _count: { _all: true } }),
    prisma.lead.count({ where: rangeWhere }),
    prisma.lead.count({ where: { ...rangeWhere, qualifiedAt: { not: null } } }),
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { not: null }, assignedAt: { gte: start, lte: end }, qualifiedAt: { not: null }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { paidAt: { gte: start, lte: end }, deletedAt: null } }),
    prisma.payment.aggregate({ where: { paidAt: { gte: start, lte: end } }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lte: end }, lead: { stage: { slug: STAGE.PAID } } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lte: end }, lead: { stage: { slug: STAGE.PARTIAL_PAYMENT } } },
      _sum: { amount: true },
    }),
    // Operator statistikasi — SHU DAVRDA BIRIKTIRILGAN leadlar bo'yicha (assignedAt),
    // ya'ni operatorning faoliyati (bugungi biriktirishlar darhol ko'rinadi)
    prisma.lead.groupBy({
      by: ["assignedToId", "stageId"],
      where: { assignedToId: { not: null }, assignedAt: { gte: start, lte: end }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.user.findMany({ where: { role: "OPERATOR" }, select: { id: true, name: true } }),
  ]);

  // slug bo'yicha sanoq
  const byStage: Record<string, number> = {};
  for (const s of pipeline.stages) byStage[s.slug] = 0;
  for (const row of byStageRaw) {
    const st = stageById.get(row.stageId);
    if (st) byStage[st.slug] = row._count._all;
  }

  const conversion = leadsTotal > 0 ? (salesCount / leadsTotal) * 100 : 0;

  // Voronka: har bosqichda HOZIR nechta lead borligini ko'rsatadi (joriy taqsimot,
  // Kanban ustunlari bilan bir xil). Rad etilganlar alohida KPI'da ko'rsatiladi.
  const funnel = pipeline.stages
    .filter((s) => s.slug !== STAGE.REJECTED)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ slug: s.slug, name: s.name, count: byStage[s.slug] ?? 0 }));

  // Operator statistikasi
  const opMap = new Map<string, OperatorStat>();
  for (const u of operators) {
    opMap.set(u.id, {
      id: u.id,
      name: u.name,
      assigned: 0,
      qualified: 0,
      rejected: 0,
      paymentPending: 0,
      partial: 0,
      sales: 0,
      conversion: 0,
    });
  }
  for (const row of opRaw) {
    if (!row.assignedToId) continue;
    const stat = opMap.get(row.assignedToId);
    if (!stat) continue;
    const st = stageById.get(row.stageId);
    const n = row._count._all;
    stat.assigned += n;
    if (!st) continue;
    if (st.slug === STAGE.REJECTED) stat.rejected += n;
    else if (st.slug === STAGE.PAYMENT_PENDING) stat.paymentPending += n;
    else if (st.slug === STAGE.PARTIAL_PAYMENT) stat.partial += n;
    else if (st.slug === STAGE.PAID) stat.sales += n;
  }
  // Sifatli lid (qualifiedAt) — alohida hisoblanadi
  for (const row of qualifiedByOp) {
    if (!row.assignedToId) continue;
    const stat = opMap.get(row.assignedToId);
    if (stat) stat.qualified += row._count._all;
  }
  for (const stat of opMap.values()) {
    stat.conversion = stat.assigned > 0 ? (stat.sales / stat.assigned) * 100 : 0;
  }

  return {
    leadsTotal,
    byStage,
    qualifiedCount,
    salesCount,
    revenue: Number(revenueAgg._sum.amount ?? 0n),
    fullPaymentSum: Number(fullAgg._sum.amount ?? 0n),
    partialPaymentSum: Number(partialAgg._sum.amount ?? 0n),
    conversion,
    funnel,
    operators: Array.from(opMap.values()).sort((a, b) => b.sales - a.sales),
  };
}
