import { leadScopeWhere, stageActivityWhere } from "./scope";
import { dateKeyToUtcStart, dateKeyToUtcEnd, tashkentDayRange } from "@/lib/datetime";
import type { Prisma, Role } from "@prisma/client";

export type LeadDatePreset = "all" | "today" | "yesterday";

export interface LeadFilterParams {
  q?: string; // ism yoki telefon
  operatorId?: string;
  source?: string;
  stageId?: string;
  campaignId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  payment?: string; // "any" | "none"
  datePreset?: LeadDatePreset; // "today"/"yesterday" — tushgan YOKI o'sha kuni ishlangan
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
  // Kun preseti: o'sha kuni TUSHGAN (createdAt) yoki o'sha kuni QABUL QILINGAN
  // (assignedAt) yoki BOSHQA BOSQICHGA O'TKAZILGAN (stageChangedAt) leadlar.
  if (params.datePreset === "today" || params.datePreset === "yesterday") {
    const base = params.datePreset === "yesterday" ? new Date(Date.now() - 86_400_000) : new Date();
    const { start, end } = tashkentDayRange(base);
    and.push(stageActivityWhere(start, end));
  }
  if (params.payment === "any") and.push({ payments: { some: {} } });
  if (params.payment === "none") and.push({ payments: { none: {} } });

  return { AND: and };
}
