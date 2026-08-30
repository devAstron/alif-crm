import { requireLeadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoardData } from "@/lib/leads/queries";
import type { LeadFilterParams } from "@/lib/leads/filters";
import { PageHeader } from "@/components/page-header";
import { KanbanBoard } from "@/components/leads/kanban-board";
import { LeadFilters } from "@/components/leads/lead-filters";
import { CreateLeadModal } from "@/components/leads/create-lead-modal";

export const metadata = { title: "Mijozlar — Alif CRM" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireLeadAccess();
  const sp = await searchParams;
  const filters: LeadFilterParams = {
    q: sp.q,
    operatorId: sp.operatorId,
    source: sp.source,
    from: sp.from,
    to: sp.to,
    payment: sp.payment,
  };
  const isAdmin = user.role === "ADMIN";
  const isTargetolog = user.role === "TARGETOLOG";
  const canSeeAll = isAdmin || isTargetolog;

  const [board, rejectionReasons, processingReasons, operators, sourceRows] = await Promise.all([
    getBoardData(user, filters),
    prisma.rejectionReason.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.processingReason.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    canSeeAll
      ? prisma.user.findMany({ where: { role: "OPERATOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.lead.groupBy({ by: ["source"], where: { deletedAt: null, source: { not: null } } }),
  ]);

  const sources = sourceRows.map((r) => r.source).filter((s): s is string => !!s);

  return (
    <>
      <PageHeader
        title="Mijozlar"
        subtitle={isTargetolog ? "Barcha leadlar (faqat ko'rish)" : "Savdo voronkasi — leadni ushlab boshqa bosqichga torting"}
        actions={!isTargetolog ? <CreateLeadModal stages={board.stages} /> : undefined}
      />
      <LeadFilters operators={operators} sources={sources} canExport={canSeeAll} isAdmin={canSeeAll} />
      <KanbanBoard
        stages={board.stages}
        initialLeadsByStage={board.leadsByStage}
        countByStage={board.countByStage}
        rejectionReasons={rejectionReasons}
        processingReasons={processingReasons}
        readOnly={isTargetolog}
        showMeta={canSeeAll}
      />
    </>
  );
}
