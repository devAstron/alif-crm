import { env } from "@/lib/env";
import { processTelegramStart } from "@/lib/telegram/handle";

export const runtime = "nodejs";

/**
 * Telegram webhook (production uchun). Lokalda polling ishlatiladi (scripts/telegram-poll.ts).
 * Xavfsizlik: X-Telegram-Bot-Api-Secret-Token TELEGRAM_WEBHOOK_SECRET bilan tekshiriladi.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  let update: { message?: { text?: string; chat?: { id?: number; username?: string } } };
  try {
    update = await req.json();
  } catch {
    return new Response("OK", { status: 200 });
  }

  const text = update.message?.text?.trim();
  const chat = update.message?.chat;
  if (text && chat?.id) {
    await processTelegramStart(text, String(chat.id), chat.username ?? null);
  }

  return new Response("OK", { status: 200 });
}
