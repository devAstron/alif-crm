"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { defaultHomeFor } from "@/lib/auth";
import { AUDIT } from "@/lib/constants";

const schema = z.object({
  login: z.string().trim().min(1, "Login kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const ip = await getClientIp();

  // Brute-force himoyasi: IP bo'yicha 1 daqiqada 10 urinish
  const rl = rateLimit(`login:${ip ?? "unknown"}`, 10, 60_000);
  if (!rl.ok) {
    return {
      error: `Juda ko'p urinish. ${rl.retryAfterSec} soniyadan so'ng qayta urinib ko'ring.`,
    };
  }

  const parsed = schema.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };
  }

  const { login, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { login } });

  // Vaqt hujumini kamaytirish uchun user topilmasa ham tekshiruvni bajaramiz
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidino");

  if (!user || !valid) {
    return { error: "Login yoki parol noto'g'ri" };
  }
  if (!user.isActive) {
    return { error: "Hisobingiz faol emas. Administrator bilan bog'laning." };
  }

  const h = await headers();
  await createSession(user.id, { ip, userAgent: h.get("user-agent") });
  await writeAudit({
    userId: user.id,
    action: AUDIT.LOGIN,
    entity: "User",
    entityId: user.id,
    ip,
  });

  redirect(defaultHomeFor(user.role));
}
