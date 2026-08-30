import { prisma } from "./prisma";
import { sendTelegramMessage, isTelegramConfigured } from "./telegram/client";
import type { NotificationType, Prisma } from "@prisma/client";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  leadId?: string | null;
  data?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}

/**
 * CRM ichki bildirishnomasi yaratadi.
 * (Telegram yuborish 6-bosqichda shu joyga ulanadi.)
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const client = params.tx ?? prisma;
  await client.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      leadId: params.leadId ?? null,
      data: params.data,
    },
  });

  // Telegram orqali ham yuboramiz (bog'langan bo'lsa; best-effort).
  // Bot token sozlanmagan bo'lsa — keraksiz baza so'rovini o'tkazib yuboramiz.
  if (!isTelegramConfigured()) return;
  try {
    const account = await prisma.telegramAccount.findUnique({ where: { userId: params.userId } });
    if (account) {
      const text = `<b>${params.title}</b>${params.body ? `\n${params.body}` : ""}`;
      await sendTelegramMessage(account.chatId, text);
    }
  } catch (e) {
    console.error("[Notification] Telegram yuborishda xato", e);
  }
}

/** O'qilmagan bildirishnomalar soni. */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

/** Foydalanuvchi bildirishnomalari (eng yangi 50 ta). */
export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
