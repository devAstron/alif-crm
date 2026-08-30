import { prisma } from "@/lib/prisma";
import { AUDIT } from "@/lib/constants";
import { formatSom } from "@/lib/serialize";

export type TimelineKind =
  | "created"
  | "stage_change"
  | "assign"
  | "field_update"
  | "comment"
  | "task_created"
  | "task_done"
  | "payment"
  | "delete"
  | "restore";

export interface TimelineItem {
  id: string;
  at: Date;
  kind: TimelineKind;
  text: string;
  userName: string | null;
  body?: string | null;
}

/** Lead uchun to'liq faoliyat tarixini yig'adi (turli manbalardan, vaqt bo'yicha). */
export async function getLeadActivity(leadId: string): Promise<TimelineItem[]> {
  const [audits, comments, tasks, payments, stages] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: "Lead", entityId: leadId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.comment.findMany({
      where: { leadId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { leadId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { leadId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pipelineStage.findMany({ select: { slug: true, name: true } }),
  ]);

  const stageName = new Map(stages.map((s) => [s.slug, s.name]));
  const items: TimelineItem[] = [];

  for (const a of audits) {
    const newData = (a.newData ?? {}) as Record<string, unknown>;
    const oldData = (a.oldData ?? {}) as Record<string, unknown>;
    if (a.action === AUDIT.LEAD_CREATE) {
      items.push({ id: a.id, at: a.createdAt, kind: "created", text: "Lead yaratildi", userName: a.user?.name ?? "Tizim" });
    } else if (a.action === AUDIT.LEAD_STAGE_CHANGE) {
      const from = stageName.get(String(oldData.stage)) ?? "—";
      const to = stageName.get(String(newData.stage)) ?? "—";
      items.push({ id: a.id, at: a.createdAt, kind: "stage_change", text: `Bosqich: ${from} → ${to}`, userName: a.user?.name ?? null });
    } else if (a.action === AUDIT.LEAD_ASSIGN || a.action === AUDIT.LEAD_REASSIGN) {
      items.push({ id: a.id, at: a.createdAt, kind: "assign", text: "Operatorga biriktirildi", userName: a.user?.name ?? null });
    } else if (a.action === AUDIT.LEAD_FIELD_UPDATE) {
      items.push({ id: a.id, at: a.createdAt, kind: "field_update", text: "Ma'lumot o'zgartirildi", userName: a.user?.name ?? null });
    } else if (a.action === AUDIT.LEAD_DELETE) {
      items.push({ id: a.id, at: a.createdAt, kind: "delete", text: "Lead o'chirildi", userName: a.user?.name ?? null });
    } else if (a.action === AUDIT.LEAD_RESTORE) {
      items.push({ id: a.id, at: a.createdAt, kind: "restore", text: "Lead tiklandi", userName: a.user?.name ?? null });
    }
  }

  for (const c of comments) {
    items.push({ id: c.id, at: c.createdAt, kind: "comment", text: "Izoh qoldirildi", userName: c.author.name, body: c.body });
  }

  for (const t of tasks) {
    items.push({ id: `t-${t.id}`, at: t.createdAt, kind: "task_created", text: "Vazifa yaratildi", userName: t.createdBy.name, body: t.note });
    if (t.status === "DONE" && t.completedAt) {
      items.push({ id: `td-${t.id}`, at: t.completedAt, kind: "task_done", text: "Vazifa bajarildi", userName: null, body: t.note });
    }
  }

  for (const p of payments) {
    items.push({
      id: p.id,
      at: p.createdAt,
      kind: "payment",
      text: `To'lov: ${formatSom(p.amount)}`,
      userName: p.createdBy.name,
      body: p.note,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items;
}
