import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export type { SessionUser };

/** Joriy foydalanuvchi (yoki null). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

/** Foydalanuvchi kirgan bo'lishi shart — aks holda /login ga yo'naltiradi. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Foydalanuvchi berilgan rollardan biriga ega bo'lishi shart.
 * Ruxsat yo'q bo'lsa o'z bosh sahifasiga yo'naltiradi.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(defaultHomeFor(user.role));
  }
  return user;
}

/**
 * Mijozlar (leadlar) bo'limi uchun: ADMIN yoki OPERATOR.
 * Operator Telegram botni faollashtirmagan bo'lsa — dashboardga yo'naltiriladi.
 */
export async function requireLeadAccess(): Promise<SessionUser> {
  const user = await requireRole("ADMIN", "OPERATOR", "TARGETOLOG");
  if (user.role === "OPERATOR") {
    const account = await prisma.telegramAccount.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!account) redirect("/dashboard");
  }
  return user;
}

/** Rol bo'yicha standart bosh sahifa. */
export function defaultHomeFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/dashboard";
    case "TARGETOLOG":
      return "/targetolog";
    case "OPERATOR":
    default:
      return "/dashboard";
  }
}
