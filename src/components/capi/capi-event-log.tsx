"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Eye, Loader2 } from "lucide-react";
import { retryCapiEventAction } from "@/lib/actions/capi-actions";
import { formatTashkent } from "@/lib/datetime";
import type { CapiEventView } from "@/lib/capi/queries";

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
  PENDING: "bg-amber-50 text-amber-700",
  RETRYING: "bg-amber-50 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Muvaffaqiyatli",
  FAILED: "Xatolik",
  PENDING: "Kutilmoqda",
  RETRYING: "Qayta urinilmoqda",
};

export function CapiEventLog({ events }: { events: CapiEventView[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function retry(id: string) {
    startTransition(async () => {
      await retryCapiEventAction(id);
      router.refresh();
    });
  }

  if (events.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">
        Hozircha CAPI eventlari yo&apos;q
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">
        CAPI eventlar jurnali
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-2.5 font-medium">Event</th>
              <th className="px-3 py-2.5 font-medium">Lead</th>
              <th className="px-3 py-2.5 font-medium">Holat</th>
              <th className="px-3 py-2.5 text-center font-medium">HTTP</th>
              <th className="px-3 py-2.5 text-center font-medium">Retry</th>
              <th className="px-3 py-2.5 font-medium">Vaqt</th>
              <th className="px-4 py-2.5 text-right font-medium">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <Fragment key={e.id}>
                <tr className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {e.eventName === "QUALIFIED_LEAD" ? "QualifiedLead" : "Purchase"}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{e.leadName}</td>
                  <td className="px-3 py-2.5">
                    <span className={`badge ${STATUS_STYLE[e.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.httpStatus ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.retryCount}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-400">{formatTashkent(e.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="Ma'lumot">
                        <Eye className="h-4 w-4" />
                      </button>
                      {e.status === "FAILED" && (
                        <button onClick={() => retry(e.id)} disabled={pending} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Qayta yuborish">
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="px-4 py-3">
                      {e.error && <p className="mb-2 text-sm text-red-600">Xato: {e.error}</p>}
                      <p className="mb-1 text-xs font-medium text-slate-500">Payload (xavfsiz — maxfiy ma&apos;lumotlar hashlangan):</p>
                      <pre className="mb-2 overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-700">
                        {JSON.stringify(e.payloadSafe, null, 2)}
                      </pre>
                      {e.response && (
                        <>
                          <p className="mb-1 text-xs font-medium text-slate-500">Javob:</p>
                          <pre className="overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-700">{e.response}</pre>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
