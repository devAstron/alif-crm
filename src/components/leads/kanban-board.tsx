"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { LeadCardView } from "./lead-card";
import { StageChangeModal, type StageChangeExtraInput } from "./stage-change-modal";
import { moveLeadStageAction } from "@/lib/actions/lead-actions";
import { attachReceiptAction } from "@/lib/actions/receipt-actions";
import type { LeadCard } from "@/lib/leads/queries";

export interface BoardStage {
  id: string;
  name: string;
  slug: string;
  color: string;
  requiredFields: string[];
}

interface Props {
  stages: BoardStage[];
  initialLeadsByStage: Record<string, LeadCard[]>;
  countByStage: Record<string, number>;
  rejectionReasons: { id: string; name: string }[];
  processingReasons: { id: string; name: string }[];
  readOnly?: boolean;
  showMeta?: boolean;
  receiptsEnabled?: boolean;
}

function DraggableCard({
  card,
  onOpen,
  showMeta,
}: {
  card: LeadCard;
  onOpen: (id: string) => void;
  showMeta: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { fromStageId: card.stageId },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(card.id)}
      className={`cursor-grab touch-none active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <LeadCardView card={card} showMeta={showMeta} />
    </div>
  );
}

function DroppableColumn({
  stage,
  count,
  children,
}: {
  stage: BoardStage;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
          <span className="text-sm font-semibold text-slate-700">{stage.name}</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-32 flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 transition-colors ${
          isOver ? "border-brand-400 bg-brand-50/50" : "border-slate-200 bg-slate-50/50"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** SSR va mount oldidan ko'rsatiladigan statik ustun (drag'siz). */
function StaticColumn({
  stage,
  count,
  cards,
  onOpen,
  showMeta,
}: {
  stage: BoardStage;
  count: number;
  cards: LeadCard[];
  onOpen: (id: string) => void;
  showMeta: boolean;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
          <span className="text-sm font-semibold text-slate-700">{stage.name}</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {count}
        </span>
      </div>
      <div className="flex min-h-32 flex-1 flex-col gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-2">
        {cards.map((card) => (
          <button key={card.id} onClick={() => onOpen(card.id)} className="text-left">
            <LeadCardView card={card} showMeta={showMeta} />
          </button>
        ))}
        {cards.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-slate-400">Bo&apos;sh</p>
        )}
      </div>
    </div>
  );
}

const emptySubscribe = () => () => {};

export function KanbanBoard({
  stages,
  initialLeadsByStage,
  countByStage,
  rejectionReasons,
  processingReasons,
  readOnly = false,
  showMeta = false,
  receiptsEnabled = false,
}: Props) {
  const router = useRouter();
  const [board, setBoard] = useState(initialLeadsByStage);
  const [counts, setCounts] = useState(countByStage);
  const [mobileStage, setMobileStage] = useState(stages[0]?.id ?? "");

  // @dnd-kit SSR'da barqaror emas — faqat client mount bo'lgach draggable qilamiz
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  // router.refresh() dan keyin server ma'lumoti o'zgarsa, state'ni render vaqtida yangilash
  // (React tavsiyasi: prop o'zgarganda state'ni to'g'rilash — effect'siz)
  const [prevInit, setPrevInit] = useState(initialLeadsByStage);
  if (prevInit !== initialLeadsByStage) {
    setPrevInit(initialLeadsByStage);
    setBoard(initialLeadsByStage);
    setCounts(countByStage);
  }

  const [pending, setPending] = useState<{
    card: LeadCard;
    fromStageId: string;
    toStage: BoardStage;
  } | null>(null);
  const [moving, setMoving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const openLead = (id: string) => router.push(`/leads/${id}`);

  function moveLocal(cardId: string, from: string, to: string): Record<string, LeadCard[]> {
    const next: Record<string, LeadCard[]> = {};
    for (const k of Object.keys(board)) next[k] = [...board[k]];
    const idx = next[from]?.findIndex((c) => c.id === cardId) ?? -1;
    if (idx >= 0) {
      const [orig] = next[from].splice(idx, 1);
      const toStage = stages.find((s) => s.id === to);
      const card: LeadCard = { ...orig, stageId: to, stageSlug: toStage?.slug ?? orig.stageSlug };
      next[to] = [card, ...(next[to] ?? [])];
    }
    return next;
  }

  async function performMove(
    card: LeadCard,
    fromStageId: string,
    toStage: BoardStage,
    extra: StageChangeExtraInput = {},
    receiptFile: File | null = null,
  ) {
    setMoving(true);
    setModalError(null);
    const snapshot = board;
    const snapshotCounts = counts;

    // Optimistik
    setBoard(moveLocal(card.id, fromStageId, toStage.id));
    setCounts({
      ...counts,
      [fromStageId]: Math.max(0, (counts[fromStageId] ?? 1) - 1),
      [toStage.id]: (counts[toStage.id] ?? 0) + 1,
    });

    const result = await moveLeadStageAction({
      leadId: card.id,
      toStageId: toStage.id,
      callbackAt: extra.callbackAt,
      rejectionReasonId: extra.rejectionReasonId,
      rejectionNote: extra.rejectionNote,
      processingStatus: extra.processingStatus,
      paymentAmount: extra.paymentAmount,
    });

    setMoving(false);

    if (result.ok) {
      setPending(null);
      if (receiptFile && result.data?.paymentId) {
        const fd = new FormData();
        fd.set("file", receiptFile);
        await attachReceiptAction(result.data.paymentId, fd);
      }
      router.refresh();
      return;
    }

    // Xatolik — qaytaramiz
    setBoard(snapshot);
    setCounts(snapshotCounts);

    if (result.code === "required_fields") {
      // Modal ochish (agar hali ochilmagan bo'lsa)
      setPending({ card, fromStageId, toStage });
      setModalError(result.error ?? null);
    } else {
      setBanner(result.error ?? "Xatolik yuz berdi.");
      setPending(null);
      setTimeout(() => setBanner(null), 4000);
    }
  }

  function attemptMove(card: LeadCard, fromStageId: string, toStage: BoardStage) {
    const needsModal =
      toStage.requiredFields.includes("callbackAt") ||
      toStage.requiredFields.includes("rejectionReasonId") ||
      toStage.slug === "in_progress" ||
      toStage.slug === "partial_payment" ||
      toStage.slug === "paid";
    if (needsModal) {
      setModalError(null);
      setPending({ card, fromStageId, toStage });
    } else {
      performMove(card, fromStageId, toStage);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const fromStageId = active.data.current?.fromStageId as string | undefined;
    const toStageId = over.id as string;
    if (!fromStageId || fromStageId === toStageId) return;
    const card = board[fromStageId]?.find((c) => c.id === active.id);
    const toStage = stages.find((s) => s.id === toStageId);
    if (!card || !toStage) return;
    attemptMove(card, fromStageId, toStage);
  }

  return (
    <>
      {banner && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {banner}
        </div>
      )}

      {/* Desktop: Kanban ustunlari (drag & drop) */}
      <div className="hidden lg:block">
        {mounted && !readOnly ? (
          <DndContext id="kanban-dnd" sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="scroll-thin flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => (
                <DroppableColumn key={stage.id} stage={stage} count={counts[stage.id] ?? 0}>
                  {(board[stage.id] ?? []).map((card) => (
                    <DraggableCard key={card.id} card={card} onOpen={openLead} showMeta={showMeta} />
                  ))}
                  {(board[stage.id] ?? []).length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-slate-400">Bo&apos;sh</p>
                  )}
                </DroppableColumn>
              ))}
            </div>
          </DndContext>
        ) : (
          <div className="scroll-thin flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <StaticColumn
                key={stage.id}
                stage={stage}
                count={counts[stage.id] ?? 0}
                cards={board[stage.id] ?? []}
                onOpen={openLead}
                showMeta={showMeta}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobil: bosqich tanlagich + ro'yxat */}
      <div className="lg:hidden">
        <div className="scroll-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setMobileStage(stage.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                mobileStage === stage.id
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
              {stage.name}
              <span className="text-xs text-slate-400">{counts[stage.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {(board[mobileStage] ?? []).map((card) => (
            <button key={card.id} onClick={() => openLead(card.id)} className="text-left">
              <LeadCardView card={card} showMeta={showMeta} />
            </button>
          ))}
          {(board[mobileStage] ?? []).length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">
              Bu bosqichda lead yo&apos;q
            </p>
          )}
        </div>
      </div>

      {pending && (
        <StageChangeModal
          stageName={pending.toStage.name}
          stageSlug={pending.toStage.slug}
          requiredFields={pending.toStage.requiredFields}
          rejectionReasons={rejectionReasons}
          processingReasons={processingReasons}
          receiptsEnabled={receiptsEnabled}
          loading={moving}
          error={modalError}
          onSubmit={(extra, file) => performMove(pending.card, pending.fromStageId, pending.toStage, extra, file)}
          onCancel={() => {
            setPending(null);
            setModalError(null);
          }}
        />
      )}
    </>
  );
}
