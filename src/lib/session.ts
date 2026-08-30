import "server-only";
import { cookies } from "next/headers";
import { addDays } from "date-fns";
import { prisma } from "./prisma";
import { generateToken, hashToken } from "./crypto";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "./constants";
import { env } from "./env";
import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  login: string;
  role: Role;
  isActive: boolean;
}

/**
 * Yangi sessiya yaratadi: token generatsiya qiladi, hashini bazaga yozadi,
 * raw tokenni httpOnly cookie'ga qo'yadi.
 */
export async function createSession(
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<void> {
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Joriy sessiyani cookie orqali topib, foydalanuvchini qaytaradi.
 * Muddati o'tgan yoki nofaol bo'lsa null.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, name: true, login: true, role: true, isActive: true },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Muddati o'tgan sessiyani tozalaymiz
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.isActive) return null;

  return session.user;
}

/** Joriy sessiyani o'chiradi (logout). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  cookieStore.delete(SESSION_COOKIE);
}
