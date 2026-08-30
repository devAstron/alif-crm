"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { deleteLeadAction } from "@/lib/actions/lead-actions";

export function LeadDeleteButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteLeadAction(leadId);
      if (res.ok) {
        router.push("/leads");
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
        title="O'chirish"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="card relative z-10 w-full max-w-sm p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Leadni o&apos;chirish</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-4 text-sm text-slate-600">Bu leadni o&apos;chirishni tasdiqlaysizmi? U ro&apos;yxatdan yo&apos;qoladi, lekin admin uni tiklashi mumkin.</p>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Bekor qilish</button>
              <button onClick={confirmDelete} disabled={pending} className="btn-danger flex-1">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
