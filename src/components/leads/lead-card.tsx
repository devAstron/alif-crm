import { Phone, Clock, CircleDollarSign, User2, BadgeCheck, RefreshCw, Ban } from "lucide-react";
import type { LeadCard as LeadCardType } from "@/lib/leads/queries";
import { sourceLabel } from "@/lib/format";
import { formatTashkent, formatCallbackShort } from "@/lib/datetime";
import { formatSom } from "@/lib/serialize";
import { STAGE } from "@/lib/constants";

/**
 * Kanban lead kartasi.
 * showMeta=false (operator) — manba va biriktirilgan operator teglari yashiriladi
 * (operator faqat o'z leadlarini ko'radi, ular ortiqcha). Admin/targetolog: hammasi.
 * Bosqichga bog'liq teglar (biriktirilmagan / qayta aloqa vaqti / rad sababi) barcha rollarda.
 */
export function LeadCardView({ card, showMeta = false }: { card: LeadCardType; showMeta?: boolean }) {
  const isUnprocessed = card.stageSlug === STAGE.UNPROCESSED;
  const isCallback = card.stageSlug === STAGE.CALLBACK;
  const isRejected = card.stageSlug === STAGE.REJECTED;
  const isProcessing = card.stageSlug === STAGE.IN_PROGRESS && !!card.processingStatus;
  const callbackOverdue = card.callbackAt && new Date(card.callbackAt) <= new Date();
  const unassigned = !card.assignedToName;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-semibold text-slate-900">{card.name}</span>
        <span className="shrink-0 text-[11px] text-slate-400">
          {formatTashkent(card.createdAt, "dd.MM HH:mm")}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Phone className="h-3.5 w-3.5" />
        <span dir="ltr">{card.phone}</span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {card.qualifiedAt && (
          <span className="badge bg-teal-50 text-teal-700">
            <BadgeCheck className="h-3 w-3" />
            Sifatli lid
          </span>
        )}

        {isProcessing && (
          <span className="badge bg-violet-50 text-violet-700">
            <RefreshCw className="h-3 w-3" />
            {card.processingStatus}
          </span>
        )}

        {isCallback && card.callbackAt && (
          <span className={`badge ${callbackOverdue ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
            <Clock className="h-3 w-3" />
            {formatCallbackShort(card.callbackAt)} da
          </span>
        )}

        {isRejected && card.rejectionReasonName && (
          <span className="badge bg-red-50 text-red-600">
            <Ban className="h-3 w-3" />
            {card.rejectionReasonName}
          </span>
        )}

        {showMeta && (
          <span className="badge bg-slate-100 text-slate-600">{sourceLabel(card.source)}</span>
        )}

        {showMeta && !unassigned && (
          <span className="badge bg-brand-50 text-brand-700">
            <User2 className="h-3 w-3" />
            {card.assignedToName}
          </span>
        )}

        {unassigned && (showMeta || isUnprocessed) && (
          <span className="badge bg-amber-50 text-amber-700">Biriktirilmagan</span>
        )}

        {card.totalPaid > 0 && (
          <span className="badge bg-green-50 text-green-700">
            <CircleDollarSign className="h-3 w-3" />
            {formatSom(card.totalPaid)}
          </span>
        )}
      </div>
    </div>
  );
}
