"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { AUDIT } from "@/lib/constants";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";
import type { Role } from "@prisma/client";

const ROLES = ["ADMIN", "OPERATOR", "TARGETOLOG"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "Ism kiriting").max(100),
  login: z.string().trim().min(3, "Login kamida 3 belgi").max(50).regex(/^[a-zA-Z0-9_.]+$/, "Login faqat harf, raqam, _ va ."),
  password: z.string().min(6, "Parol kamida 6 belgi").max(100),
  role: z.enum(ROLES),
});

export async function createUserAction(input: {
  name: string;
  login: string;
  password: string;
  role: Role;
}): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    const existing = await prisma.user.findUnique({ where: { login: parsed.data.login } });
    if (existing) throw new DomainError("login_taken", "Bu login band.");
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        login: parsed.data.login,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
      },
    });
    await writeAudit({ userId: admin.id, action: AUDIT.USER_UPDATE, entity: "User", entityId: user.id, newData: { login: parsed.data.login, role: parsed.data.role, action: "create" }, ip: await getClientIp() });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  role: z.enum(ROLES),
  isActive: z.boolean(),
});

export async function updateUserAction(input: {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
}): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  try {
    // O'zini nofaol qilib qo'ymaslik
    if (parsed.data.id === admin.id && !parsed.data.isActive) {
      throw new DomainError("self_deactivate", "O'zingizni nofaol qila olmaysiz.");
    }
    await prisma.user.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name, role: parsed.data.role, isActive: parsed.data.isActive },
    });
    await writeAudit({ userId: admin.id, action: AUDIT.USER_UPDATE, entity: "User", entityId: parsed.data.id, newData: { name: parsed.data.name, role: parsed.data.role, isActive: parsed.data.isActive, action: "update" }, ip: await getClientIp() });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resetPasswordAction(input: { id: string; password: string }): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const pw = z.string().min(6, "Parol kamida 6 belgi").max(100).safeParse(input.password);
  if (!pw.success) return { ok: false, error: pw.error.issues[0]?.message ?? "Xato" };
  try {
    await prisma.user.update({ where: { id: input.id }, data: { passwordHash: await hashPassword(pw.data) } });
    // Barcha sessiyalarni bekor qilamiz
    await prisma.session.deleteMany({ where: { userId: input.id } });
    await writeAudit({ userId: admin.id, action: AUDIT.USER_UPDATE, entity: "User", entityId: input.id, newData: { action: "reset_password" }, ip: await getClientIp() });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
