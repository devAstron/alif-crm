import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError, apiServerError, safeEqual } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getIpFromRequest } from "@/lib/request";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { AUDIT } from "@/lib/constants";
import { z } from "zod";

export const runtime = "nodejs";

const operatorStatusSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    login: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
    action: z.enum(["activate", "deactivate", "enable", "disable", "on", "off", "toggle"]).optional(),
    status: z.enum(["active", "inactive", "disabled"]).optional(),
  })
  .refine((data) => data.id || data.login, {
    message: "Operatorni aniqlash uchun 'id' yoki 'login' kiritilishi shart.",
    path: ["id"],
  })
  .refine(
    (data) =>
      typeof data.isActive === "boolean" ||
      typeof data.action === "string" ||
      typeof data.status === "string",
    {
      message:
        "O'zgartirish holatini ko'rsating: 'isActive' (true/false) yoki 'action' ('activate'/'deactivate').",
      path: ["isActive"],
    },
  );

/**
 * Autentifikatsiyani tekshirish:
 * 1. X-API-Key yoki Authorization: Bearer <CRM_API_KEY>
 * 2. Yoki tizimga kirgan Admin foydalanuvchi sessiyasi
 */
async function authenticate(req: Request): Promise<{ ok: boolean; adminUserId?: string }> {
  // 1. API Key tekshiruvi
  const headerKey =
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (headerKey && env.CRM_API_KEY && safeEqual(headerKey, env.CRM_API_KEY)) {
    return { ok: true };
  }

  // 2. Admin sessiyasi tekshiruvi
  try {
    const sessionUser = await getCurrentUser();
    if (sessionUser && sessionUser.role === "ADMIN") {
      return { ok: true, adminUserId: sessionUser.id };
    }
  } catch {
    // Sessiya mavjud bo'lmasa yoki xato bersa
  }

  return { ok: false };
}

/**
 * POST /api/operators/status
 *
 * Call center operatorining hisobini o'chirish (nofaol qilish) yoki yoqish (faollashtirish).
 *
 * Headers:
 *   X-API-Key: <CRM_API_KEY> (yoki Authorization: Bearer <CRM_API_KEY>)
 *   Content-Type: application/json
 *
 * Body namunalari:
 *   { "login": "operator1", "isActive": false }
 *   { "login": "operator1", "action": "deactivate" }
 *   { "id": "clx...", "isActive": true }
 */
export async function POST(req: Request) {
  const ip = getIpFromRequest(req);

  // 1. Rate limiting (60 so'rov / daqiqa)
  const rl = rateLimit(`operator-status-api:${ip ?? "unknown"}`, 60, 60_000);
  if (!rl.ok) {
    return apiError("rate_limited", "Juda ko'p so'rov yuborildi. Keyinroq urinib ko'ring.", 429, {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  // 2. Autentifikatsiya tekshiruvi
  const auth = await authenticate(req);
  if (!auth.ok) {
    return apiError("unauthorized", "API kalit noto'g'ri yoki ruxsat etilmagan.", 401);
  }

  // 3. Body ni parse qilish
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "So'rov tanasi to'g'ri JSON formatida bo'lishi kerak.", 400);
  }

  // 4. Validatsiya
  const parsed = operatorStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation_error", "Ma'lumotlar validatsiyadan o'tmadi.", 400, {
      fields: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const { id, login, isActive, action, status } = parsed.data;

  try {
    // 5. Operatorni topish
    const operator = await prisma.user.findFirst({
      where: id ? { id } : { login },
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        isActive: true,
      },
    });

    if (!operator) {
      return apiError("not_found", "Ko'rsatilgan login yoki ID bo'yicha foydalanuvchi topilmadi.", 404);
    }

    // 6. Faqat operatorlar ustida amal bajarilishini tekshirish
    if (operator.role !== "OPERATOR") {
      return apiError(
        "invalid_role",
        `Faqat OPERATOR rolidagi xodimlarni yoqish/o'chirish mumkin. Topilgan rol: ${operator.role}`,
        400,
      );
    }

    // 7. Yangi isActive holatini aniqlash
    let nextActive: boolean;
    if (typeof isActive === "boolean") {
      nextActive = isActive;
    } else if (action) {
      if (action === "toggle") {
        nextActive = !operator.isActive;
      } else if (["activate", "enable", "on"].includes(action)) {
        nextActive = true;
      } else {
        nextActive = false;
      }
    } else if (status) {
      nextActive = status === "active";
    } else {
      nextActive = !operator.isActive;
    }

    // 8. Bazada holatni yangilash
    const updatedUser = await prisma.user.update({
      where: { id: operator.id },
      data: { isActive: nextActive },
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // 9. Agar hisob o'chirilsa (nofaol qilinsa), uning barcha faol sessiyalarini bekor qilish
    if (!nextActive) {
      await prisma.session.deleteMany({
        where: { userId: operator.id },
      });
    }

    // 10. Audit logiga yozish
    await writeAudit({
      userId: auth.adminUserId ?? null,
      action: AUDIT.USER_UPDATE,
      entity: "User",
      entityId: operator.id,
      oldData: { isActive: operator.isActive },
      newData: {
        isActive: nextActive,
        action: nextActive ? "activate" : "deactivate",
        source: "operator_status_api",
      },
      ip: ip ?? null,
    });

    return apiOk({
      message: nextActive
        ? `Operator '${updatedUser.name}' (${updatedUser.login}) hisobi muvaffaqiyatli yoqildi (faollashtirildi).`
        : `Operator '${updatedUser.name}' (${updatedUser.login}) hisobi muvaffaqiyatli o'chirildi (nofaol qilindi).`,
      operator: updatedUser,
    });
  } catch (error) {
    return apiServerError(error, "POST /api/operators/status");
  }
}
