"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Loader2, Clock } from "lucide-react";
import { createTaskAction, toggleTaskAction } from "@/lib/actions/task-actions";
import { formatTashkent } from "@/lib/datetime";
import { DateTimeQuick } from "@/components/ui/datetime-quick";

export interface TaskItem {
  id: string;
  dueAt: Date;
  note: string | null;
  status: "PENDING" | "DONE";
  type: "MANUAL" | "CALLBACK";
  assignedToName: string | null;
}

export function LeadTasks({ leadId, tasks, readOnly = false }: { leadId: string; tasks: TaskItem[]; readOnly?: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createTaskAction({ leadId, dueAt, note });
      if (res.ok) {
        setAdding(false);
        setDueAt("");
        setNote("");
        router.refresh();
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  function toggle(id: string) {
    startTransition(async () => {
      await toggleTaskAction(id);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Vazifalar</h3>
        {!readOnly && (
          <button onClick={() => setAdding((v) => !v)} className="btn-ghost px-2 py-1 text-sm">
            <Plus className="h-4 w-4" />
            Qo&apos;shish
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="label">Sana va vaqt</label>
            <DateTimeQuick value={dueAt} onChange={setDueAt} />
          </div>
          <div>
            <label className="label">Izoh (ixtiyoriy)</label>
            <input type="text" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nima qilish kerak?" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={submit} disabled={pending || !dueAt} className="btn-primary w-full">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Saqlash
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">Vazifalar yo&apos;q</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-2.5">
              <button
                onClick={() => !readOnly && toggle(t.id)}
                disabled={pending || readOnly}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                  t.status === "DONE"
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-slate-300 hover:border-brand-500"
                } ${readOnly ? "cursor-default" : ""}`}
              >
                {t.status === "DONE" && <Check className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${t.status === "DONE" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                  {t.note || (t.type === "CALLBACK" ? "Qayta aloqa" : "Vazifa")}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  {formatTashkent(t.dueAt)}
                  {t.type === "CALLBACK" && (
                    <span className="ml-1 rounded bg-amber-50 px-1.5 text-amber-600">Qayta aloqa</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
