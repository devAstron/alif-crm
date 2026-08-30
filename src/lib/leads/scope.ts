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
