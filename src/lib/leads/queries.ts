import { prisma } from "@/lib/prisma";
import { getDefaultPipeline } from "@/lib/pipeline";
import { STAGE } from "@/lib/constants";
import { leadScopeWhere } from "./scope";
import { buildLeadWhere, type LeadFilterParams } from "./filters";
import type { Role } from "@prisma/client";

export { leadScopeWhere };

export interface LeadCard {
  id: string;
  title: string;
  name: string;
  phone: string;
  source: string | null;
  stageId: string;
  stageSlug: string;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: Date;
  stageChangedAt: Date;
  callbackAt: Date | null;
  totalPaid: number;
  qualifiedAt: Date | null;
  processingStatus: string | null;
  rejectionReasonName: string | null;
}

const MAX_CARDS_PER_STAGE = 100;

/**
 * Bitta leadni batafsil oladi (rol tekshiruvi bilan).
 * Ruxsat yo'q yoki topilmasa null qaytaradi.
 */
export async function getLeadDetail(user: { id: string; role: Role }, id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      stage: true,
      pipeline: { include: { stages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } },
      assignedTo: { select: { id: true, name: true } },
      rejectionReason: { select: { name: true } },
      customFieldValues: {
        include: { field: true },
      },
    },
  });

  if (!lead) return null;

  // Operator faqat o'ziga biriktirilgan yoki "Ko'rib chiqilmagan" leadni ko'radi
  if (user.role === "OPERATOR") {
    const allowed = lead.assignedToId === user.id || lead.stage.slug === STAGE.UNPROCESSED;
    if (!allowed) return null;
  }

  // To'lovlar yig'indisi + telefon tarixi — parallel (round-trip'ni kamaytirish)
  const [paidAgg, refundAgg, history] = await Promise.all([
    prisma.payment.aggregate({ where: { leadId: id }, _sum: { amount: true } }),
    prisma.refund.aggregate({ where: { leadId: id }, _sum: { amount: true } }),
    prisma.lead.findMany({
      where: { phone: lead.phone, id: { not: id }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        stage: { select: { name: true, color: true } },
        comments: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    }),
  ]);

  return {
    lead,
    // Sof to'langan summa — qaytarilgan (Refund) summalar ayrilgan holda.
    totalPaid: Number((paidAgg._sum.amount ?? 0n) - (refundAgg._sum.amount ?? 0n)),
    history: history.map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      stageName: h.stage.name,
      stageColor: h.stage.color,
      lastComment: h.comments[0]?.body ?? null,
    })),
  };
}

/**
 * Kanban uchun ma'lumot: bosqichlar, har bosqichdagi kartalar (cheklangan) va aniq sanoq.
 */
export async function getBoardData(
  user: { id: string; role: Role },
  filters: LeadFilterParams = {},
) {
  const pipeline = await getDefaultPipeline();
  const where = buildLeadWhere(user, filters);

  const [leads, counts, payments, refunds] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { stageChangedAt: "desc" },
      take: pipeline.stages.length * MAX_CARDS_PER_STAGE,
      select: {
        id: true,
        title: true,
        name: true,
        phone: true,
        source: true,
        stageId: true,
        stage: { select: { slug: true } },
        assignedToId: true,
        assignedTo: { select: { name: true } },
        createdAt: true,
        stageChangedAt: true,
        callbackAt: true,
        qualifiedAt: true,
        processingStatus: true,
        rejectionReason: { select: { name: true } },
      },
    }),
    prisma.lead.groupBy({
      by: ["stageId"],
      where,
      _count: { _all: true },
    }),
    // Kartalardagi to'lov indikatori uchun jami to'lovlar
    prisma.payment.groupBy({
      by: ["leadId"],
      where: { lead: where },
      _sum: { amount: true },
    }),
    // Qaytarilgan summalar — kartada sof (qaytarilgandan keyingi) summa ko'rinishi uchun
    prisma.refund.groupBy({
      by: ["leadId"],
      where: { lead: where },
      _sum: { amount: true },
    }),
  ]);

  const refundedByLead = new Map(refunds.map((r) => [r.leadId, Number(r._sum.amount ?? 0n)]));
  const paidByLead = new Map(
    payments.map((p) => [p.leadId, Number(p._sum.amount ?? 0n) - (refundedByLead.get(p.leadId) ?? 0)]),
  );

  const cards: LeadCard[] = leads.map((l) => ({
    id: l.id,
    title: l.title,
    name: l.name,
    phone: l.phone,
    source: l.source,
    stageId: l.stageId,
    stageSlug: l.stage.slug,
    assignedToId: l.assignedToId,
    assignedToName: l.assignedTo?.name ?? null,
    createdAt: l.createdAt,
    stageChangedAt: l.stageChangedAt,
    callbackAt: l.callbackAt,
    totalPaid: paidByLead.get(l.id) ?? 0,
    qualifiedAt: l.qualifiedAt,
    processingStatus: l.processingStatus,
    rejectionReasonName: l.rejectionReason?.name ?? null,
  }));

  const leadsByStage: Record<string, LeadCard[]> = {};
  for (const stage of pipeline.stages) leadsByStage[stage.id] = [];
  for (const card of cards) {
    (leadsByStage[card.stageId] ??= []).push(card);
  }

  const countByStage: Record<string, number> = {};
  for (const c of counts) countByStage[c.stageId] = c._count._all;

  return {
    stages: pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      color: s.color,
      requiredFields: (s.requiredFields as string[]) ?? [],
    })),
    leadsByStage,
    countByStage,
  };
}
