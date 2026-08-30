import { env } from "@/lib/env";

/**
 * Telegram Bot API mijozi. Token env'da (TELEGRAM_BOT_TOKEN).
 * Token bo'lmasa — no-op (xato bermaydi).
 */

const API = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return !!env.TELEGRAM_BOT_TOKEN;
}

/** Telegramga xabar yuboradi. Hech qachon throw qilmaydi. */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch (e) {
    console.error("[Telegram] sendMessage error", e);
    return false;
  }
}

let cachedUsername: string | null = null;

/** Bot username'ini getMe orqali oladi (deep-link uchun). Keshlanadi. */
export async function getBotUsername(): Promise<string | null> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  if (cachedUsername) return cachedUsername;
  try {
    const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
    if (!res.ok) return null;
    const data = await res.json();
    cachedUsername = data?.result?.username ?? null;
    return cachedUsername;
  } catch {
    return null;
  }
}
