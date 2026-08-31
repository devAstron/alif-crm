"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Clock, Phone, ChevronRight, User2 } from "lucide-react";
import { toggleTaskAction } from "@/lib/actions/task-actions";
import { formatTashkent } from "@/lib/datetime";
import { telHref } from "@/lib/format";
import type { TaskRow } from "@/lib/tasks/queries";

function Row({ task, onToggle, pending, readOnly }: { task: TaskRow; onToggle: (id: string) => void; pending: boolean; readOnly: boolean }) {
  const overdue = task.status === "PENDING" && new Date(task.dueAt) < new Date();
  const statusCircle = (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
        task.status === "DONE" ? "border-green-500 bg-green-500 text-white" : "border-slate-300"
      }`}
    >
      {task.status === "DONE" && <Check className="h-4 w-4" />}
    </span>
  );
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
      {readOnly ? (
        statusCircle
      ) : (
        <button
          onClick={() => onToggle(task.id)}
          disabled={pending}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
            task.status === "DONE"
              ? "border-green-500 bg-green-500 text-white"
              : "border-slate-300 hover:border-brand-500"
          }`}
        >
          {task.status === "DONE" && <Check className="h-4 w-4" />}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${task.status === "DONE" ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {task.leadName}
          </span>
          {task.type === "CALLBACK" && (
            <span className="badge bg-amber-50 text-amber-600">Qayta aloqa</span>
          )}
          {readOnly && task.assignedToName && (
            <span className="badge bg-brand-50 text-brand-700">
              <User2 className="h-3 w-3" />
              {task.assignedToName}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-slate-500">{task.note || task.leadPhone}</p>
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${overdue ? "text-red-600" : "text-slate-600"}`}>
          <Clock className="h-3.5 w-3.5" />
          {formatTashkent(task.dueAt)}
          {overdue && " · muddati o'tgan"}
        </p>
      </div>

      <a href={telHref(task.leadPhone)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Qo'ng'iroq">
        <Phone className="h-4 w-4" />
      </a>
      <Link href={`/leads/${task.leadId}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" title="Ochish">
        <ChevronRight className="h-4 w-4" />
      </Link>
    </li>
  );
}

export function TaskList({ pending, done, readOnly = false }: { pending: TaskRow[]; done: TaskRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    startTransition(async () => {
      await toggleTaskAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Bajarilishi kerak ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            Bajarilmagan vazifalar yo&apos;q
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((t) => (
              <Row key={t.id} task={t} onToggle={toggle} pending={isPending} readOnly={readOnly} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Bajarilgan</h2>
          <ul className="space-y-2">
            {done.map((t) => (
              <Row key={t.id} task={t} onToggle={toggle} pending={isPending} readOnly={readOnly} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
