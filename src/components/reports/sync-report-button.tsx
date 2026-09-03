"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { runAdSyncAction } from "@/lib/actions/fb-actions";

/**
 * "Kechani hisoblash" — reklama sarfini Facebook'dan bir tugma bilan tortib,
 * Hisobotlar jadvaliga yozadi. Har kuni 05:00'da avtomatik ham ishlaydi
 * (cron: /api/cron/ad-sync); bu tugma qo'lda darhol ishga tushirish uchun.
 */
export function SyncReportButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function sync() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await runAdSyncAction();
      if (res.ok && res.data) {
        const dateFmt = res.data.date.split("-").reverse().join(".");
        const usdStr = `$${(res.data.adSpendUsd / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
        setMsg(`${dateFmt}: reklama sarfi ${usdStr} deb yozildi`);
        router.refresh();
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button onClick={sync} disabled={pending} className="btn-secondary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Kechani hisoblash
      </button>
      {msg && <p className="max-w-xs text-right text-xs text-green-600">{msg}</p>}
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
