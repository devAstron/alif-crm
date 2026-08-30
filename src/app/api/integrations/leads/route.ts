import { env } from "@/lib/env";
import { apiOk, apiError, apiServerError, safeEqual } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getIpFromRequest } from "@/lib/request";
import { incomingLeadSchema } from "@/lib/leads/schemas";
import { createIncomingLead } from "@/lib/leads/service";

export const runtime = "nodejs";

/**
 * So'rov tanasini o'qiydi: JSON, x-www-form-urlencoded yoki multipart.
 * Turli integratorlar (Make.com, Albato, o'zbek servislar) turlicha yuboradi.
 */
async function parseRequestBody(req: Request): Promise<Record<string, unknown> | null> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();

  function fromForm(fd: FormData): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string") obj[k] = v;
    return normalize(obj);
  }
  // form'da `custom`/`cookies` string kelsa — JSON'ga o'giramiz
  function normalize(obj: Record<string, unknown>): Record<string, unknown> {
    for (const key of ["custom", "cookies"]) {
      if (typeof obj[key] === "string") {
        try {
          obj[key] = JSON.parse(obj[key] as string);
        } catch {
          if (key === "custom") delete obj[key];
        }
      }
    }
    return obj;
  }

  try {
    // Multipart — alohida (formData kerak)
    if (ct.includes("multipart/form-data")) {
      return fromForm(await req.formData());
    }
    // Qolgan hamma holatda: raw matnni bir marta o'qib, avval JSON, keyin
    // urlencoded sifatida urinib ko'ramiz. Shunday qilib Content-Type header
    // body formatiga mos kelmasa ham (json header + form body yoki aksincha) ishlaydi.
    const text = await req.text();
    if (!text.trim()) return null;
    try {
      return normalize(JSON.parse(text));
    } catch {
      const params = new URLSearchParams(text);
      const obj: Record<string, unknown> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return Object.keys(obj).length ? normalize(obj) : null;
    }
  } catch {
    return null;
  }
}

/**
 * Kiruvchi lead API — tashqi integratorlar (Make.com, Albato) leadni shu yerga yuboradi.
 *
 *   POST /api/integrations/leads
 *   Header:  X-API-Key: <CRM_API_KEY>   (yoki Authorization: Bearer <CRM_API_KEY>)
 *   Header:  Idempotency-Key: <ixtiyoriy>
 *   Body:    JSON (schemas.ts ga qarang)
 */
export async function POST(req: Request) {
  const ip = getIpFromRequest(req);

  // 1) Rate limiting (IP bo'yicha daqiqada 120 so'rov)
  const rl = rateLimit(`lead-api:${ip ?? "unknown"}`, 120, 60_000);
  if (!rl.ok) {
    return apiError("rate_limited", "Juda ko'p so'rov. Keyinroq urinib ko'ring.", 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  // 2) API kalitni tekshirish
  const headerKey =
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!headerKey || !safeEqual(headerKey, env.CRM_API_KEY)) {
    return apiError("unauthorized", "API kalit noto'g'ri yoki yo'q.", 401);
  }

  // 3) Body — JSON yoki form (x-www-form-urlencoded / multipart) — har ikkisi qabul qilinadi
  const body = await parseRequestBody(req);
  if (!body) {
    return apiError("invalid_body", "So'rov tanasini o'qib bo'lmadi (JSON yoki form kutiladi).", 400);
  }

  // 4) Validatsiya
  const parsed = incomingLeadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Ma'lumotlar validatsiyadan o'tmadi.", 400, {
      fields: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // 5) Idempotency kaliti: header > body.idempotency_key > body.lead_id
  const idempotencyKey =
    req.headers.get("idempotency-key") ??
    parsed.data.idempotency_key ??
    parsed.data.lead_id ??
    null;

  // 6) Yaratish
  try {
    const { lead, duplicate } = await createIncomingLead(parsed.data, {
      idempotencyKey,
      ip,
    });
    return apiOk(
      { id: lead.id, status: "unprocessed", duplicate },
      duplicate ? 200 : 201,
    );
  } catch (error) {
    return apiServerError(error, "POST /api/integrations/leads");
  }
}
