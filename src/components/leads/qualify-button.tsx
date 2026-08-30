"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, X, Loader2, Check } from "lucide-react";
import { markQualifiedAction, unmarkQualifiedAction } from "@/lib/actions/lead-actions";

const CHECKLIST = [
  "Telefon raqami mijozning o'ziga tegishli",
  "Haqiqatan ham Arab tili kursimizga qiziqish bildirib so'rov qoldirgan",
];

export function QualifyButton({
  leadId,
  qualified,
  isAdmin,
}: {
  leadId: string;
  qualified: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allChecked = checks.every(Boolean);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await markQualifiedAction(leadId);
      if (res.ok) { setOpen(false); router.refresh(); }
      else setError(res.error ?? "Xatolik");
    });
  }

  function unmark() {
    startTransition(async () => {
      await unmarkQualifiedAction(leadId);
      router.refresh();
    });
  }

  if (qualified) {
    return (
      <div className="flex items-center gap-2">
        <span className="badge bg-teal-50 px-3 py-1.5 text-teal-700">
          <BadgeCheck className="h-4 w-4" />
          Sifatli lid
        </span>
        {isAdmin && (
          <button onClick={unmark} disabled={pending} className="text-xs text-slate-400 hover:text-red-600" title="Belgini olib tashlash">
            {pending ? "..." : "bekor"}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn bg-teal-600 text-white hover:bg-teal-700">
        <BadgeCheck className="h-4 w-4" />
        Sifatli lid deb belgilash
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="card relative z-10 w-full max-w-md rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Sifatli lid deb belgilash</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-slate-600">Ushbu lid sifatli lidmi? Quyidagilarni tasdiqlang:</p>
              {CHECKLIST.map((item, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    checked={checks[i]}
                    onChange={(e) => setChecks((prev) => prev.map((c, idx) => (idx === i ? e.target.checked : c)))}
                  />
                  <span className="text-sm text-slate-700">{item}</span>
                </label>
              ))}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <p className="text-xs text-slate-400">Tasdiqlashda Meta&apos;ga «QualifiedLead» signali yuboriladi.</p>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">Bekor qilish</button>
              <button onClick={confirm} disabled={!allChecked || pending} className="btn flex-1 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
