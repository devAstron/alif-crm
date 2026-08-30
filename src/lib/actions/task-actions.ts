"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { getClientIp } from "@/lib/request";
import { assertLeadAccess } from "@/lib/leads/access";
import { AUDIT } from "@/lib/constants";
import { DomainError, ForbiddenError, toActionError, type ActionResult } from "@/lib/errors";

const createSchema = z.object({
  leadId: z.string().min(1),
  dueAt: z.string().min(1, "Sana va vaqtni kiriting"),
  note: z.string().trim().max(1000).optional(),
});

/** Lead detalidan qo'lda vazifa yaratish. */
export async function createTaskAction(input: {
  leadId: string;
  dueAt: string;
  note?: string;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  }

  try {
    const lead = await assertLeadAccess(user, parsed.data.leadId);
    const ip = await getClientIp();
    const assigneeId = lead.assignedToId ?? user.id;
    const dueAt = new Date(parsed.data.dueAt);

    const task = await prisma.task.create({
      data: {
        leadId: parsed.data.leadId,
        type: "MANUAL",
        dueAt,
        note: parsed.data.note || null,
        createdById: user.id,
        assignedToId: assigneeId,
      },
    });
    await writeAudit({
      userId: user.id,
      action: AUDIT.TASK_CREATE,
      entity: "Task",
      entityId: task.id,
      newData: { leadId: parsed.data.leadId, dueAt },
      ip,
    });
    if (assigneeId !== user.id) {
      await createNotification({
        userId: assigneeId,
        type: "TASK_NEW",
        title: "Yangi vazifa",
        body: `${lead.name} bo'yicha vazifa`,
        leadId: parsed.data.leadId,
      });
    }
    revalidatePath(`/leads/${parsed.data.leadId}`);
    revalidatePath("/tasks");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Vazifani bajarilgan/bajarilmagan qilib belgilash. */
export async function toggleTaskAction(taskId: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new DomainError("not_found", "Vazifa topilmadi.");
    if (user.role === "OPERATOR" && task.assignedToId !== user.id) {
      throw new ForbiddenError("Bu vazifa sizga tegishli emas.");
    }
    const done = task.status !== "DONE";
    await prisma.task.update({
      where: { id: taskId },
      data: { status: done ? "DONE" : "PENDING", completedAt: done ? new Date() : null },
    });
    const ip = await getClientIp();
    await writeAudit({
      userId: user.id,
      action: AUDIT.TASK_UPDATE,
      entity: "Task",
      entityId: taskId,
      newData: { status: done ? "DONE" : "PENDING" },
      ip,
    });
    revalidatePath("/tasks");
    revalidatePath(`/leads/${task.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
