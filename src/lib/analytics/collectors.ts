import { prisma } from "@/lib/prisma";
import { STAGE } from "@/lib/constants";

/**
 * Undiruvchi (COLLECTOR) ko'rsatkichlari. "Undirilgan" = shu undiruvchi KIRITGAN
 * to'lovlar (Payment.createdById), to'lov qilingan kuni (paidAt) bo'yicha.
 * Sotuv esa undiruvchiga EMAS, leadni qisman to'lovga olgan operatorga yoziladi
 * (Lead.assignedToId o'zgarmaydi) — bu ko'rsatkichlar operator statistikasiga
 * qo'shilmaydi.
 */
export interface CollectorStat {
  id: string;
  name: string;
  closedLeads: number; // shu davrda "To'lov qildi"ga yopgan leadlar (FULL to'lov kiritgan, noyob lead)
  payments: number; // kiritgan to'lovlar soni (qisman ham)
  collectedSum: number; // so'm
}

export interface CollectorDashboard extends Omit<CollectorStat, "id" | "name"> {
  waitingLeads: number; // hozir "Qisman to'lov qildi" bosqichidagi leadlar (hamma operatorlarniki)
}

async function collectedBy(userIds: string[] | null, start: Date, end: Date) {
  const rows = await prisma.payment.findMany({
    where: {
      paidAt: { gte: start, lte: end },
      lead: { deletedAt: null },
      createdBy: userIds ? { id: { in: userIds } } : { role: "COLLECTOR" },
    },
    select: { amount: true, kind: true, leadId: true, createdById: true },
  });
  const byUser = new Map<string, { closed: Set<string>; payments: number; sum: number }>();
  for (const r of rows) {
    let u = byUser.get(r.createdById);
    if (!u) { u = { closed: new Set(), payments: 0, sum: 0 }; byUser.set(r.createdById, u); }
    u.payments += 1;
    u.sum += Number(r.amount);
    if (r.kind === "FULL") u.closed.add(r.leadId);
  }
  return byUser;
}

/** Bitta undiruvchining paneli. */
export async function getCollectorDashboardData(userId: string, start: Date, end: Date): Promise<CollectorDashboard> {
  const [byUser, waitingLeads] = await Promise.all([
    collectedBy([userId], start, end),
    prisma.lead.count({ where: { deletedAt: null, stage: { slug: STAGE.PARTIAL_PAYMENT } } }),
  ]);
  const u = byUser.get(userId);
  return { waitingLeads, closedLeads: u?.closed.size ?? 0, payments: u?.payments ?? 0, collectedSum: u?.sum ?? 0 };
}

/** Admin uchun: barcha faol undiruvchilar. */
export async function getCollectorStats(start: Date, end: Date): Promise<CollectorStat[]> {
  const [collectors, byUser] = await Promise.all([
    prisma.user.findMany({ where: { role: "COLLECTOR", isActive: true }, select: { id: true, name: true } }),
    collectedBy(null, start, end),
  ]);
  return collectors
    .map((c) => {
      const u = byUser.get(c.id);
      return { id: c.id, name: c.name, closedLeads: u?.closed.size ?? 0, payments: u?.payments ?? 0, collectedSum: u?.sum ?? 0 };
    })
    .sort((a, b) => b.collectedSum - a.collectedSum);
}
