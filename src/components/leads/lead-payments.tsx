"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CircleDollarSign, Pencil, Trash2, Check, X } from "lucide-react";
import { addPaymentAction, updatePaymentAction, deletePaymentAction } from "@/lib/actions/payment-actions";
import { formatSom } from "@/lib/serialize";
import { formatTashkent } from "@/lib/datetime";

export interface PaymentRow {
  id: string;
  amount: number;
  note: string | null;
  paidAt: Date;
  createdByName: string | null;
}

export function LeadPayments({
  leadId,
  payments,
  total,
  readOnly = false,
}: {
  leadId: string;
  payments: PaymentRow[];
  total: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  function submit() {
    setError(null);
    const num = Number(amount);
    if (!num || num <= 0) {
      setError("To'g'ri summa kiriting");
      return;
    }
    startTransition(async () => {
      const res = await addPaymentAction({ leadId, amount: Math.trunc(num), note });
      if (res.ok) {
        setAdding(false);
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  function saveEdit() {
    const num = Number(editAmount);
    if (!num || num <= 0) return;
    startTransition(async () => {
      const res = await updatePaymentAction({ paymentId: editId!, amount: Math.trunc(num), note: editNote });
      if (res.ok) { setEditId(null); router.refresh(); }
    });
  }

  function remove(id: string) {
    if (!confirm("Bu to'lovni o'chirishni tasdiqlaysizmi?")) return;
    startTransition(async () => {
      await deletePaymentAction(id);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">To&apos;lovlar</h3>
        {!readOnly && (
          <button onClick={() => setAdding((v) => !v)} className="btn-ghost px-2 py-1 text-sm">
            <Plus className="h-4 w-4" />
            Qo&apos;shish
          </button>
        )}
      </div>
      <p className="text-2xl font-semibold text-slate-900">{formatSom(total)}</p>
      <p className="mb-3 text-xs text-slate-400">Jami to&apos;langan summa</p>

      {adding && (
        <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="label">Summa (so&apos;m)</label>
            <input type="number" min={0} step={1000} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Masalan: 500000" />
          </div>
          <div>
            <label className="label">Izoh (ixtiyoriy)</label>
            <input type="text" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={submit} disabled={pending} className="btn-primary w-full">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Saqlash
          </button>
        </div>
      )}

      {payments.length > 0 && (
        <ul className="space-y-2">
          {payments.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-100 p-2.5">
              {editId === p.id ? (
                <div className="space-y-2">
                  <input type="number" min={0} step={1000} className="input" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                  <input type="text" className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Izoh" />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={pending} className="btn-primary py-1.5 text-sm">
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Saqlash
                    </button>
                    <button onClick={() => setEditId(null)} className="btn-secondary py-1.5 text-sm"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <CircleDollarSign className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{formatSom(p.amount)}</p>
                    <p className="text-xs text-slate-400">
                      {formatTashkent(p.paidAt)}
                      {p.createdByName && ` · ${p.createdByName}`}
                      {p.note && ` · ${p.note}`}
                    </p>
                  </div>
                  {!readOnly && (
                    <>
                      <button onClick={() => { setEditId(p.id); setEditAmount(String(p.amount)); setEditNote(p.note ?? ""); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="Tahrirlash">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(p.id)} disabled={pending} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="O'chirish">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
