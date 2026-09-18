"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { restoreLeadAction } from "@/lib/actions/lead-actions";
import { formatTashkent } from "@/lib/datetime";

export interface DeletedLead {
  id: string;
  name: string;
  phone: string;
  deletedAt: Date | null;
  deletedByName: string | null;
  deleteReason: string | null;
}

export function DeletedLeads({ leads }: { leads: DeletedLead[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function restore(id: string) {
    startTransition(async () => {
      await restoreLeadAction(id);
      router.refresh();
    });
  }

  if (leads.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">O&apos;chirilgan leadlar yo&apos;q</p>;
  }

  return (
    <div className="space-y-2">
      {leads.map((l) => (
        <div key={l.id} className="card flex items-center gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">{l.name}</p>
            <p className="text-xs text-slate-400" dir="ltr">
              {l.phone}
              {l.deletedAt && ` · o'chirilgan: ${formatTashkent(l.deletedAt)}`}
              {l.deletedByName && ` · ${l.deletedByName}`}
            </p>
            {l.deleteReason && (
              <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                Sabab: {l.deleteReason}
              </p>
            )}
          </div>
          <button onClick={() => restore(l.id)} disabled={pending} className="btn-secondary py-1.5">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Tiklash
          </button>
        </div>
      ))}
    </div>
  );
}
