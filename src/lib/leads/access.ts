import { prisma } from "@/lib/prisma";
import { STAGE } from "@/lib/constants";
import { DomainError, ForbiddenError } from "@/lib/errors";
import type { Role } from "@prisma/client";

/**
 * Foydalanuvchi leadga kira oladimi?
 *  - ADMIN: har doim
 *  - OPERATOR: o'ziga biriktirilgan yoki "Ko'rib chiqilmagan" bosqichdagi lead
 *  - TARGETOLOG: leadlar bilan ishlamaydi
 */
export function canAccessLead(
  user: { id: string; role: Role },
  lead: { assignedToId: string | null; stageSlug: string },
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "TARGETOLOG") return true; // faqat ko'rish (read-only)
  if (user.role === "OPERATOR") {
    return lead.assignedToId === user.id || lead.stageSlug === STAGE.UNPROCESSED;
  }
  return false;
}

/** Leadni oladi va kirish huquqini tekshiradi (aks holda xato tashlaydi). */
export async function assertLeadAccess(user: { id: string; role: Role }, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: { stage: { select: { slug: true } } },
  });
  if (!lead) throw new DomainError("not_found", "Lead topilmadi.");
  if (!canAccessLead(user, { assignedToId: lead.assignedToId, stageSlug: lead.stage.slug })) {
    throw new ForbiddenError("Bu lead sizga tegishli emas.");
  }
  return lead;
}
