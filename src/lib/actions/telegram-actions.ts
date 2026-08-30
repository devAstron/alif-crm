"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/crypto";
import { getBotUsername } from "@/lib/telegram/client";
import { writeAudit } from "@/lib/audit";
import { AUDIT } from "@/lib/constants";
import { addMinutes } from "date-fns";

export interface LinkCodeResult {
  ok: boolean;
  code?: string;
  deepLink?: string | null;
  error?: string;
}

/** Telegram bog'lash uchun kod generatsiya qiladi (15 daqiqa amal qiladi). */
export async function generateTelegramLinkCodeAction(): Promise<LinkCodeResult> {
  const user = await requireUser();
  const code = generateToken(4); // 8 belgi
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramLinkCode: code, telegramLinkCodeExpiresAt: addMinutes(new Date(), 15) },
  });
  const username = await getBotUsername();
  return {
    ok: true,
    code,
    deepLink: username ? `https://t.me/${username}?start=${code}` : null,
  };
}

/** Telegram bog'lanishini uzish. */
export async function unlinkTelegramAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await prisma.telegramAccount.deleteMany({ where: { userId: user.id } });
  await writeAudit({
    userId: user.id,
    action: AUDIT.TELEGRAM_LINK,
    entity: "TelegramAccount",
    entityId: user.id,
    newData: { action: "unlink" },
  });
  revalidatePath("/profile");
  return { ok: true };
}
