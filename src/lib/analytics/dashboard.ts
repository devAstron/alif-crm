import { prisma } from "@/lib/prisma";
import { getDefaultPipeline } from "@/lib/pipeline";
import { STAGE } from "@/lib/constants";
import { stageActivityWhere } from "@/lib/leads/scope";

export interface DashboardData {
  leadsTotal: number;
  byStage: Record<string, number>; // slug -> count (range leadlari, joriy bosqich)
  qualifiedCount: number; // sifatli lid (qualifiedAt belgilangan)
  salesCount: number;
  revenue: number; // sof tushum: shu davr to'lovlari - shu davr qaytarishlari
  fullPaymentSum: number;
  partialPaymentSum: number;
  refundedTotal: number; // shu davrda qaytarilgan summa (refundedAt bo'yicha)
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
  revenue: number; // shu davrda operatorning leadlaridan kelgan tushum (so'm)
  conversion: number;
}

/** Dashboard uchun barcha ko'rsatkichlar (sana oralig'i UTC). */
export async function getDashboardData(start: Date, end: Date): Promise<DashboardData> {
  const pipeline = await getDefaultPipeline();
  const stageById = new Map(pipeline.stages.map((s) => [s.id, s]));

  const rangeWhere = { createdAt: { gte: start, lte: end }, deletedAt: null };
  // Bosqich statistikasi (funnel + Yangi lead/Qayta aloqa/Rad etilgan/To'lov
  // kutilmoqda/Qisman to'lov kartalari) — Mijozlar/Kanban ("Bugun"/"Kecha"
  // filtri) BILAN BIR XIL mezon: TUSHGAN yoki BIRIKTIRILGAN yoki BOSQICHI
  // O'ZGARGAN shu davrda bo'lsa (stageActivityWhere, src/lib/leads/scope.ts).
  // Ikkalasi turlicha bo'lsa — bir xil kun uchun turli sonlar chiqib,
  // chalkashlik keltirib chiqaradi (aynan shu farq aniqlanib tuzatilgan edi).
  const stageActivityLeadWhere = { deletedAt: null, ...stageActivityWhere(start, end) };

  const [
    byStageRaw,
    leadsTotal,
    qualifiedCount,
    qualifiedByOp,
    salesCount,
    revenueAgg,
    fullAgg,
    partialAgg,
    refundAgg,
    opRaw,
    salesByOp,
    revenueByOpRaw,
    refundByOpRaw,
    operators,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ["stageId"], where: stageActivityLeadWhere, _count: { _all: true } }),
    prisma.lead.count({ where: rangeWhere }),
    // Sifatli lid — qualifiedAt shu davrda bo'lsa (lead qачon tushganidan qat'i nazar)
    prisma.lead.count({ where: { qualifiedAt: { gte: start, lte: end }, deletedAt: null } }),
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { not: null }, qualifiedAt: { gte: start, lte: end }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { paidAt: { gte: start, lte: end }, deletedAt: null } }),
    // Barcha to'lov summalari — O'CHIRILGAN leadlarni chiqarib tashlab
    // (lead: {deletedAt: null}). Aks holda o'chirilgan (test/dublikat/xato)
    // leadga yozilgan to'lov Dashboard summasiga kirib, Kanban/Mijozlar bilan
    // mos kelmay qolardi (Kanban o'chirilgan leadlarni umuman ko'rsatmaydi).
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lte: end }, lead: { deletedAt: null } },
      _sum: { amount: true },
    }),
    // To'liq/qisman to'lov — Payment.kind bo'yicha (to'lov YARATILGAN paytdagi
    // turi, lead HOZIRGI bosqichi emas). Aks holda kechagi qisman to'lov, lead
    // bugun to'liq to'lovga o'tgach, retrospektiv "to'liq" bo'lib qayta yozilardi.
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lte: end }, kind: "FULL", lead: { deletedAt: null } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lte: end }, kind: "PARTIAL", lead: { deletedAt: null } },
      _sum: { amount: true },
    }),
    // Qaytarilgan summa — qaytarish SODIR BO'LGAN kunga qarab (refundedAt),
    // to'lov qilingan kundan mustaqil ("kunlik kassa oqimi" mezoni — bugungi
    // kirim va bugungi chiqim alohida hisoblanadi, o'tgan kunlar tarixi
    // qayta yozilmaydi).
    prisma.refund.aggregate({
      where: { refundedAt: { gte: start, lte: end }, lead: { deletedAt: null } },
      _sum: { amount: true },
    }),
    // Operator statistikasi (Rad etilgan/Kutilmoqda/Qisman ustunlari) — shu
    // davrda faoliyat bo'lgan (stageActivityWhere) leadlar bo'yicha, joriy
    // biriktirilgan operator kesimida.
    prisma.lead.groupBy({
      by: ["assignedToId", "stageId"],
      where: { assignedToId: { not: null }, ...stageActivityLeadWhere },
      _count: { _all: true },
    }),
    // Operator sotuvlari — paidAt bo'yicha (sotuv qachon yopilgan), joriy bosqichdan
    // qat'i nazar. Lead PAID'dan keyin "Sinov darsi"ga o'tsa ham sotuv saqlanadi.
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { assignedToId: { not: null }, paidAt: { gte: start, lte: end }, deletedAt: null },
      _count: { _all: true },
    }),
    // Operator tushumi — paidAt bo'yicha, leadning biriktirilgan operatoriga qarab
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end }, lead: { assignedToId: { not: null }, deletedAt: null } },
      select: { amount: true, lead: { select: { assignedToId: true } } },
    }),
    // Operator tushumidan ayiriladigan qaytarishlar — refundedAt bo'yicha
    prisma.refund.findMany({
      where: { refundedAt: { gte: start, lte: end }, lead: { assignedToId: { not: null }, deletedAt: null } },
      select: { amount: true, lead: { select: { assignedToId: true } } },
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

  // Voronka: shu davrda HAR BOSQICHGA NECHTA LEAD O'TGANINI ko'rsatadi
  // (stageChangedAt bo'yicha) — Kanban'ning joriy holati emas. Masalan lead
  // 5 kun oldin tushib, bugun "To'lov qildi"ga o'tsa — bugungi voronkada
  // ko'rinadi (keyin "Sinov darsi"ga o'tib ketsa ham). Rad etilganlar
  // alohida KPI'da ko'rsatiladi.
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
      revenue: 0,
      conversion: 0,
    });
  }
  for (const row of opRaw) {
    if (!row.assignedToId) continue;
    const stat = opMap.get(row.assignedToId);
    if (!stat) continue;
    const st = stageById.get(row.stageId);
    const n = row._count._all;
    stat.assigned += n; // shu davrda bosqichi o'zgargan (faoliyat ko'rsatilgan) leadlar soni
    if (!st) continue;
    if (st.slug === STAGE.REJECTED) stat.rejected += n;
    else if (st.slug === STAGE.PAYMENT_PENDING) stat.paymentPending += n;
    else if (st.slug === STAGE.PARTIAL_PAYMENT) stat.partial += n;
  }
  // Sotuvlar — paidAt bo'yicha (joriy bosqichdan qat'i nazar)
  for (const row of salesByOp) {
    if (!row.assignedToId) continue;
    const stat = opMap.get(row.assignedToId);
    if (stat) stat.sales += row._count._all;
  }
  // Tushum — paidAt bo'yicha, lead biriktirilgan operator kesimida
  for (const p of revenueByOpRaw) {
    const opId = p.lead.assignedToId;
    if (!opId) continue;
    const stat = opMap.get(opId);
    if (stat) stat.revenue += Number(p.amount);
  }
  // Qaytarishlar — o'sha operatorning tushumidan ayiriladi (refundedAt bo'yicha)
  for (const r of refundByOpRaw) {
    const opId = r.lead.assignedToId;
    if (!opId) continue;
    const stat = opMap.get(opId);
    if (stat) stat.revenue -= Number(r.amount);
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
    revenue: Number(revenueAgg._sum.amount ?? 0n) - Number(refundAgg._sum.amount ?? 0n),
    fullPaymentSum: Number(fullAgg._sum.amount ?? 0n),
    partialPaymentSum: Number(partialAgg._sum.amount ?? 0n),
    refundedTotal: Number(refundAgg._sum.amount ?? 0n),
    conversion,
    funnel,
    operators: Array.from(opMap.values()).sort((a, b) => b.revenue - a.revenue || b.sales - a.sales),
  };
}
