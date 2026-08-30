import { prisma } from "@/lib/prisma";
import { tashkentDayRange } from "@/lib/datetime";
import type { Prisma, Role } from "@prisma/client";

export interface TaskRow {
  id: string;
  dueAt: Date;
  note: string | null;
  status: "PENDING" | "DONE";
  type: "MANUAL" | "CALLBACK";
  completedAt: Date | null;
  leadId: string;
  leadName: string;
  leadPhone: string;
  assignedToName: string | null;
}

function scope(user: { id: string; role: Role }): Prisma.TaskWhereInput {
  // Operator faqat o'z vazifalarini ko'radi; admin barchasini
  return user.role === "OPERATOR" ? { assignedToId: user.id } : {};
}

/** Foydalanuvchi uchun vazifalar: bajarilmagan + yaqinda bajarilgan, va bugungi sanoq. */
export async function getTasksForUser(user: { id: string; role: Role }) {
  const where = scope(user);
  const { end } = tashkentDayRange();

  const [pending, done, todayCount] = await Promise.all([
    prisma.task.findMany({
      where: { ...where, status: "PENDING" },
      orderBy: { dueAt: "asc" },
      include: { lead: { select: { id: true, name: true, phone: true } }, assignedTo: { select: { name: true } } },
      take: 200,
    }),
    prisma.task.findMany({
      where: { ...where, status: "DONE" },
      orderBy: { completedAt: "desc" },
      include: { lead: { select: { id: true, name: true, phone: true } }, assignedTo: { select: { name: true } } },
      take: 50,
    }),
    prisma.task.count({ where: { ...where, status: "PENDING", dueAt: { lte: end } } }),
  ]);

  const map = (t: (typeof pending)[number]): TaskRow => ({
    id: t.id,
    dueAt: t.dueAt,
    note: t.note,
    status: t.status,
    type: t.type,
    completedAt: t.completedAt,
    leadId: t.leadId,
    leadName: t.lead.name,
    leadPhone: t.lead.phone,
    assignedToName: t.assignedTo?.name ?? null,
  });

  return { pending: pending.map(map), done: done.map(map), todayCount };
}
