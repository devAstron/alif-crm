import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { formatTashkent } from "@/lib/datetime";
import { apiOk, apiError, apiServerError } from "@/lib/api";

export const runtime = "nodejs";

/** Cron himoyasi: Authorization: Bearer <CRON_SECRET> yoki ?secret= */
function authorized(req: Request): boolean {
  if (!env.CRON_SECRET) return true; // lokal (secret o'rnatilmagan)
  const url = new URL(req.url);
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === env.CRON_SECRET || url.searchParams.get("secret") === env.CRON_SECRET;
}

/**
 * Qayta aloqa eslatmasi: qayta aloqa vaqtiga ~30 daqiqa qolganda operatorning
 * Telegramiga eslatma yuboradi. Railway cron har ~10-15 daqiqada chaqiradi.
 */
async function handle(req: Request) {
  if (!authorized(req)) return apiError("unauthorized", "Ruxsat yo'q.", 401);

  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60_000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60_000);

    const tasks = await prisma.task.findMany({
      where: {
        status: "PENDING",
        reminderSentAt: null,
        dueAt: { lte: in30, gte: sixHoursAgo },
      },
      include: {
        lead: { select: { name: true, phone: true } },
        assignedTo: { select: { telegramAccount: { select: { chatId: true } } } },
      },
      take: 100,
    });

    let sent = 0;
    for (const t of tasks) {
      const chatId = t.assignedTo.telegramAccount?.chatId;
      if (chatId) {
        const ok = await sendTelegramMessage(
          chatId,
          `⏰ <b>Qayta aloqa eslatmasi</b>\n${t.lead.name} (${t.lead.phone}) bilan ${formatTashkent(t.dueAt)} da bog'laning.`,
        );
        if (ok) sent++;
      }
      await prisma.task.update({ where: { id: t.id }, data: { reminderSentAt: now } });
    }

    return apiOk({ processed: tasks.length, sent });
  } catch (error) {
    return apiServerError(error, "GET /api/cron/reminders");
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
