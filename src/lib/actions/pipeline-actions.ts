"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { uniqueSlug } from "@/lib/slug";
import { AUDIT } from "@/lib/constants";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";

async function defaultPipelineId(): Promise<string> {
  const p = await prisma.pipeline.findFirstOrThrow({ where: { isDefault: true } });
  return p.id;
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Nom kiriting").max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Rang noto'g'ri").default("#6b7280"),
});

export async function createStageAction(input: { name: string; color: string }): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    const pipelineId = await defaultPipelineId();
    const stages = await prisma.pipelineStage.findMany({ where: { pipelineId }, select: { slug: true, sortOrder: true } });
    const slug = uniqueSlug(parsed.data.name, new Set(stages.map((s) => s.slug)));
    const maxOrder = stages.reduce((m, s) => Math.max(m, s.sortOrder), -1);
    const stage = await prisma.pipelineStage.create({
      data: { pipelineId, name: parsed.data.name, slug, color: parsed.data.color, sortOrder: maxOrder + 1 },
    });
    await writeAudit({ userId: user.id, action: AUDIT.PIPELINE_UPDATE, entity: "PipelineStage", entityId: stage.id, newData: { name: parsed.data.name, action: "create" }, ip: await getClientIp() });
    revalidatePath("/settings/pipeline");
    revalidatePath("/leads");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  requiredFields: z.array(z.string()).default([]),
});

export async function updateStageAction(input: {
  id: string;
  name: string;
  color: string;
  requiredFields: string[];
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    await prisma.pipelineStage.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name, color: parsed.data.color, requiredFields: parsed.data.requiredFields },
    });
    await writeAudit({ userId: user.id, action: AUDIT.PIPELINE_UPDATE, entity: "PipelineStage", entityId: parsed.data.id, newData: { name: parsed.data.name, action: "update" }, ip: await getClientIp() });
    revalidatePath("/settings/pipeline");
    revalidatePath("/leads");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deactivateStageAction(id: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  try {
    const stage = await prisma.pipelineStage.findUnique({ where: { id } });
    if (!stage) throw new DomainError("not_found", "Bosqich topilmadi.");
    if (stage.isSystem) throw new DomainError("system_stage", "Tizim bosqichini o'chirib bo'lmaydi.");
    const leadCount = await prisma.lead.count({ where: { stageId: id, deletedAt: null } });
    if (leadCount > 0) throw new DomainError("has_leads", `Bu bosqichda ${leadCount} ta lead bor. Avval ularni ko'chiring.`);
    await prisma.pipelineStage.update({ where: { id }, data: { isActive: false } });
    await writeAudit({ userId: user.id, action: AUDIT.PIPELINE_UPDATE, entity: "PipelineStage", entityId: id, newData: { action: "deactivate" }, ip: await getClientIp() });
    revalidatePath("/settings/pipeline");
    revalidatePath("/leads");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reorderStagesAction(orderedIds: string[]): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.pipelineStage.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    await writeAudit({ userId: user.id, action: AUDIT.PIPELINE_UPDATE, entity: "Pipeline", entityId: "reorder", newData: { action: "reorder" }, ip: await getClientIp() });
    revalidatePath("/settings/pipeline");
    revalidatePath("/leads");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
