import { env } from "@/lib/env";
import { syncAdInsights } from "@/lib/facebook/sync";
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
 * Kunlik reklama sinxronizatsiyasi (Railway cron, har kuni ~05:00 Asia/Tashkent).
 * Standart: kechagi kun. ?date=YYYY-MM-DD bilan aniq kunni qayta sinxronlash mumkin.
 */
async function handle(req: Request) {
  if (!authorized(req)) return apiError("unauthorized", "Ruxsat yo'q.", 401);

  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");

    let day: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      day = new Date(`${dateParam}T12:00:00.000+05:00`);
    } else {
      // Kecha (Toshkent)
      day = new Date(Date.now() - 24 * 60 * 60_000);
    }

    const result = await syncAdInsights(day);
    if (!result.ok) return apiError("sync_failed", result.error ?? "Sinxronlash muvaffaqiyatsiz", 400);
    return apiOk(result);
  } catch (error) {
    return apiServerError(error, "GET /api/cron/ad-sync");
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
