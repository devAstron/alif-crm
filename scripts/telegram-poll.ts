/**
 * Lokal Telegram polling worker.
 * Public URL (webhook) bo'lmagani uchun bot xabarlarini getUpdates orqali oladi.
 * Ishga tushirish: npm run telegram:poll
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* .env yo'q */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  loadEnv();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN topilmadi (.env).");
    process.exit(1);
  }

  const { processTelegramStart } = await import("../src/lib/telegram/handle");
  const API = `https://api.telegram.org/bot${token}`;

  // Webhook o'chirilsa getUpdates ishlaydi
  await fetch(`${API}/deleteWebhook`).catch(() => {});
  console.log("🤖 Telegram polling boshlandi (Ctrl+C to'xtatish uchun)...");

  let stop = false;
  process.on("SIGINT", () => { stop = true; console.log("\nTo'xtatilmoqda..."); process.exit(0); });

  let offset = 0;
  while (!stop) {
    try {
      const res = await fetch(`${API}/getUpdates?timeout=25&offset=${offset}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const upd of data.result) {
          offset = upd.update_id + 1;
          const msg = upd.message;
          const text: string | undefined = msg?.text?.trim();
          const chat = msg?.chat;
          if (text && chat?.id) {
            try {
              await processTelegramStart(text, String(chat.id), chat.username ?? null);
              console.log(`✓ Xabar ishlandi: chat=${chat.id} "${text.slice(0, 24)}"`);
            } catch (e) {
              console.error("Xabarni ishlashda xato:", e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Polling xatosi, 3s dan keyin qayta:", e instanceof Error ? e.message : e);
      await sleep(3000);
    }
  }
}

main();
