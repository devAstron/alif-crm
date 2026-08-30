import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { sendTelegramMessage } from "./client";
import { AUDIT } from "@/lib/constants";

/**
 * Telegram /start <kod> buyrug'ini qayta ishlaydi: kod bo'yicha foydalanuvchini
 * topib, TelegramAccount yaratadi/yangilaydi. Webhook ham, polling ham shuni ishlatadi.
 */
export async function processTelegramStart(
  text: string,
  chatId: string,
  username: string | null,
): Promise<void> {
  if (!/^\/start\s+/.test(text)) return;
  const code = text.replace(/^\/start\s+/, "").trim();

  const user = await prisma.user.findFirst({
    where: { telegramLinkCode: code, telegramLinkCodeExpiresAt: { gt: new Date() } },
  });

  if (!user) {
    await sendTelegramMessage(chatId, "❌ Kod noto'g'ri yoki muddati o'tgan. CRM'dan yangi kod oling.");
    return;
  }

  await prisma.telegramAccount.upsert({
    where: { userId: user.id },
    create: { userId: user.id, chatId, username },
    update: { chatId, username },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramLinkCode: null, telegramLinkCodeExpiresAt: null },
  });
  await writeAudit({
    userId: user.id,
    action: AUDIT.TELEGRAM_LINK,
    entity: "TelegramAccount",
    entityId: user.id,
    newData: { action: "link" },
  });
  await sendTelegramMessage(
    chatId,
    `✅ <b>Muvaffaqiyatli bog'landi!</b>\nSalom, ${user.name}. Endi ishni boshlashingiz mumkin — muhim bildirishnomalar shu yerga keladi.`,
  );
}
