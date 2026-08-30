import { leadScopeWhere } from "./scope";
import { dateKeyToUtcStart, dateKeyToUtcEnd } from "@/lib/datetime";
import type { Prisma, Role } from "@prisma/client";

export interface LeadFilterParams {
  q?: string; // ism yoki telefon
  operatorId?: string;
  source?: string;
  stageId?: string;
  campaignId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  payment?: string; // "any" | "none"
}

/** Rol doirasi + foydalanuvchi filtrlaridan Prisma where quradi. */
export function buildLeadWhere(
  user: { id: string; role: Role },
  params: LeadFilterParams,
): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [leadScopeWhere(user)];

  if (params.q?.trim()) {
    const q = params.q.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }
  if (params.operatorId) and.push({ assignedToId: params.operatorId });
  if (params.source) and.push({ source: params.source });
  if (params.stageId) and.push({ stageId: params.stageId });
  if (params.campaignId) and.push({ campaignId: params.campaignId });
  if (params.from) and.push({ createdAt: { gte: dateKeyToUtcStart(params.from) } });
  if (params.to) and.push({ createdAt: { lte: dateKeyToUtcEnd(params.to) } });
  if (params.payment === "any") and.push({ payments: { some: {} } });
  if (params.payment === "none") and.push({ payments: { none: {} } });

  return { AND: and };
}
