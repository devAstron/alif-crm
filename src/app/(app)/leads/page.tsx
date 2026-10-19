import { requireLeadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoardData } from "@/lib/leads/queries";
import type { LeadFilterParams } from "@/lib/leads/filters";
import { PageHeader } from "@/components/page-header";
import { KanbanBoard } from "@/components/leads/kanban-board";
import { LeadFilters } from "@/components/leads/lead-filters";
import { CreateLeadModal } from "@/components/leads/create-lead-modal";
import { isR2Configured } from "@/lib/storage/r2";
import { STAGE } from "@/lib/constants";
import { formatSom } from "@/lib/serialize";

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
    datePreset: sp.datePreset as LeadFilterParams["datePreset"],
  };
  const isAdmin = user.role === "ADMIN";
  const isTargetolog = user.role === "TARGETOLOG";
  const isCollector = user.role === "COLLECTOR";
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
        subtitle={
          isTargetolog
            ? "Barcha leadlar (faqat ko'rish)"
            : isCollector
              ? "Qisman to'lov qilgan mijozlar — qolgan to'lovni undirib, \"To'lov qildi\" deb yoping"
              : "Savdo voronkasi — leadni ushlab boshqa bosqichga torting"
        }
        actions={!isTargetolog && !isCollector ? <CreateLeadModal stages={board.stages} /> : undefined}
      />
      <LeadFilters operators={operators} sources={sources} canExport={canSeeAll} isAdmin={canSeeAll} />
      {board.period && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50/60 px-4 py-3">
          <p className="text-sm text-slate-700">
            {board.period.label} tushgan to&apos;lovlar:{" "}
            <span className="text-lg font-semibold text-green-700">{formatSom(board.period.received)}</span>
            <span className="ml-2 text-xs text-slate-500">
              {board.period.paymentsCount} ta to&apos;lov
              {board.period.refunded > 0 && ` · qaytarilgan ${formatSom(board.period.refunded)} ayrilgan`}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Kartadagi &quot;{board.period.label}&quot; — shu kunda tushgan summa, &quot;jami&quot; — mijozning butun vaqt
            davomidagi to&apos;lovi. Bu raqam Boshqaruv panelidagi &quot;Sotuv summasi&quot; bilan bir xil.
          </p>
        </div>
      )}
      <KanbanBoard
        period={board.period}
        stages={isCollector ? board.stages.filter((s) => s.slug === STAGE.PARTIAL_PAYMENT) : board.stages}
        initialLeadsByStage={board.leadsByStage}
        countByStage={board.countByStage}
        rejectionReasons={rejectionReasons}
        processingReasons={processingReasons}
        readOnly={isTargetolog}
        showMeta={canSeeAll || isCollector}
        receiptsEnabled={isR2Configured()}
      />
    </>
  );
}
