"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ArrowRightLeft,
  UserPlus,
  Pencil,
  Plus,
  CheckCircle2,
  CircleDollarSign,
  Trash2,
  RotateCcw,
  Send,
  Loader2,
} from "lucide-react";
import { addCommentAction } from "@/lib/actions/comment-actions";
import { formatTashkent } from "@/lib/datetime";
import type { TimelineItem, TimelineKind } from "@/lib/leads/timeline";

const ICONS: Record<TimelineKind, typeof MessageSquare> = {
  created: Plus,
  stage_change: ArrowRightLeft,
  assign: UserPlus,
  field_update: Pencil,
  comment: MessageSquare,
  task_created: Plus,
  task_done: CheckCircle2,
  payment: CircleDollarSign,
  delete: Trash2,
  restore: RotateCcw,
};

export function LeadActivity({ leadId, items, readOnly = false }: { leadId: string; items: TimelineItem[]; readOnly?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addCommentAction({ leadId, body });
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Izoh va faoliyat tarixi</h3>

      {/* Izoh qo'shish */}
      {!readOnly && (
        <>
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              className="input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Izoh qoldiring..."
            />
            <button onClick={submit} disabled={pending || !body.trim()} className="btn-primary shrink-0">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        </>
      )}

      {/* Timeline */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Hozircha faoliyat yo&apos;q</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const Icon = ICONS[item.kind] ?? MessageSquare;
            return (
              <li key={item.id} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    {item.text}
                    {item.userName && (
                      <span className="text-slate-400"> · {item.userName}</span>
                    )}
                  </p>
                  {item.body && (
                    <p className="mt-0.5 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                      {item.body}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">{formatTashkent(item.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
