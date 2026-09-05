import { STAGE } from "@/lib/constants";
import type { Prisma, Role } from "@prisma/client";

/**
 * Rol asosidagi ko'rish doirasi (scope):
 *  - ADMIN: barcha (o'chirilmagan) leadlar
 *  - OPERATOR: faqat o'ziga biriktirilgan + "Ko'rib chiqilmagan" umumiy lenta
 */
export function leadScopeWhere(user: { id: string; role: Role }): Prisma.LeadWhereInput {
  const base: Prisma.LeadWhereInput = { deletedAt: null };
  if (user.role === "OPERATOR") {
    return {
      ...base,
      OR: [{ assignedToId: user.id }, { stage: { slug: STAGE.UNPROCESSED } }],
    };
  }
  return base;
}

/**
 * "Shu davrda leadга tegishli harakat bo'ldimi" — TUSHGAN (createdAt) YOKI
 * BIRIKTIRILGAN (assignedAt) YOKI BOSQICHI O'ZGARGAN (stageChangedAt) kunlari
 * oraliqda bo'lsa. Mijozlar/Kanban ("Bugun"/"Kecha" filtri) va statistika
 * (Boshqaruv paneli, operator paneli) BIR XIL mezon ishlatishi uchun umumiy —
 * ikkalasi turlicha bo'lsa, bir xil kun uchun turli sonlar chiqib, chalkashlik
 * keltirib chiqaradi (aynan shu sabab aniqlangan va tuzatilgan edi).
 */
export function stageActivityWhere(start: Date, end: Date): Prisma.LeadWhereInput {
  const range = { gte: start, lte: end };
  return { OR: [{ createdAt: range }, { assignedAt: range }, { stageChangedAt: range }] };
}
