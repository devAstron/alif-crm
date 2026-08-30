"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { uniqueSlug } from "@/lib/slug";
import { AUDIT } from "@/lib/constants";
import { toActionError, type ActionResult } from "@/lib/errors";

const nameSchema = z.string().trim().min(1, "Nom kiriting").max(200);

export async function createRejectionReasonAction(name: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    const all = await prisma.rejectionReason.findMany({ select: { slug: true, sortOrder: true } });
    const slug = uniqueSlug(parsed.data, new Set(all.map((r) => r.slug)));
    const maxOrder = all.reduce((m, r) => Math.max(m, r.sortOrder), -1);
    const r = await prisma.rejectionReason.create({ data: { name: parsed.data, slug, sortOrder: maxOrder + 1 } });
    await writeAudit({ userId: user.id, action: AUDIT.SETTINGS_UPDATE, entity: "RejectionReason", entityId: r.id, newData: { name: parsed.data, action: "create" }, ip: await getClientIp() });
    revalidatePath("/settings/rejections");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateRejectionReasonAction(id: string, name: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    await prisma.rejectionReason.update({ where: { id }, data: { name: parsed.data } });
    await writeAudit({ userId: user.id, action: AUDIT.SETTINGS_UPDATE, entity: "RejectionReason", entityId: id, newData: { name: parsed.data, action: "update" }, ip: await getClientIp() });
    revalidatePath("/settings/rejections");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function toggleRejectionReasonAction(id: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  try {
    const r = await prisma.rejectionReason.findUniqueOrThrow({ where: { id } });
    await prisma.rejectionReason.update({ where: { id }, data: { isActive: !r.isActive } });
    await writeAudit({ userId: user.id, action: AUDIT.SETTINGS_UPDATE, entity: "RejectionReason", entityId: id, newData: { isActive: !r.isActive }, ip: await getClientIp() });
    revalidatePath("/settings/rejections");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
