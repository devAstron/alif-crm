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
import type { CustomFieldType } from "@prisma/client";

const TYPES = ["TEXT", "NUMBER", "SELECT", "MULTISELECT", "DATE", "CHECKBOX"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Nom kiriting").max(100),
  type: z.enum(TYPES),
  options: z.array(z.string().trim().min(1)).default([]),
  required: z.boolean().default(false),
});

export async function createCustomFieldAction(input: {
  name: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    const all = await prisma.customField.findMany({ select: { slug: true, sortOrder: true } });
    const slug = uniqueSlug(parsed.data.name, new Set(all.map((f) => f.slug)));
    const maxOrder = all.reduce((m, f) => Math.max(m, f.sortOrder), -1);
    const field = await prisma.customField.create({
      data: {
        name: parsed.data.name,
        slug,
        type: parsed.data.type,
        options: parsed.data.options,
        required: parsed.data.required,
        sortOrder: maxOrder + 1,
      },
    });
    await writeAudit({ userId: user.id, action: AUDIT.CUSTOM_FIELD_UPDATE, entity: "CustomField", entityId: field.id, newData: { name: parsed.data.name, action: "create" }, ip: await getClientIp() });
    revalidatePath("/settings/fields");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCustomFieldAction(input: {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    await prisma.customField.update({
      where: { id: input.id },
      data: { name: parsed.data.name, type: parsed.data.type, options: parsed.data.options, required: parsed.data.required },
    });
    await writeAudit({ userId: user.id, action: AUDIT.CUSTOM_FIELD_UPDATE, entity: "CustomField", entityId: input.id, newData: { name: parsed.data.name, action: "update" }, ip: await getClientIp() });
    revalidatePath("/settings/fields");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Soft-delete: faol/nofaol (mavjud lead ma'lumotlari yo'qolmaydi, §21). */
export async function toggleCustomFieldActiveAction(id: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  try {
    const field = await prisma.customField.findUniqueOrThrow({ where: { id } });
    await prisma.customField.update({ where: { id }, data: { isActive: !field.isActive } });
    await writeAudit({ userId: user.id, action: AUDIT.CUSTOM_FIELD_UPDATE, entity: "CustomField", entityId: id, newData: { isActive: !field.isActive }, ip: await getClientIp() });
    revalidatePath("/settings/fields");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
