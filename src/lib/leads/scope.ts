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
 * BIRIKTIRILGAN (assignedAt) YOKI BOSQICHI O'ZGARGAN (stageChangedAt) YOKI
 * TO'LOV QILINGAN (payments.paidAt) kunlari oraliqda bo'lsa. Mijozlar/Kanban
 * ("Bugun"/"Kecha" filtri) va statistika (Boshqaruv paneli, operator paneli)
 * BIR XIL mezon ishlatishi uchun umumiy.
 *
 * To'rtinchi shart (payments.paidAt) MUHIM: lead sahifasidagi "To'lovlar →
 * Qo'shish" tugmasi orqali (bosqich o'zgartirmasdan) to'lov qo'shilsa,
 * createdAt/assignedAt/stageChangedAt HECH BIRI o'zgarmaydi — shu sababli
 * bunday to'lov bugun qilingan bo'lsa ham, lead "Bugun" ro'yxatidan tushib
 * qolardi, garchi Boshqaruv panelidagi tushum summasiga (Payment.paidAt
 * bo'yicha, mustaqil) to'g'ri kirgan bo'lsa ham — Kanban va Dashboard
 * o'rtasida mos kelmaslik keltirib chiqargan aynan shu edi.
 */
export function stageActivityWhere(start: Date, end: Date): Prisma.LeadWhereInput {
  const range = { gte: start, lte: end };
  return {
    OR: [
      { createdAt: range },
      { assignedAt: range },
      { stageChangedAt: range },
      { payments: { some: { paidAt: range } } },
    ],
  };
}
