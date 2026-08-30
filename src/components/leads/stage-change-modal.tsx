"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { DateTimeQuick } from "@/components/ui/datetime-quick";

export interface RejectionReasonOption {
  id: string;
  name: string;
}

export interface StageChangeExtraInput {
  callbackAt?: string | null;
  rejectionReasonId?: string | null;
  rejectionNote?: string | null;
  processingStatus?: string | null;
  paymentAmount?: number | null;
  paymentNote?: string | null;
}

interface Props {
  stageName: string;
  stageSlug: string;
  requiredFields: string[];
  rejectionReasons: RejectionReasonOption[];
  processingReasons?: RejectionReasonOption[];
  loading?: boolean;
  error?: string | null;
  onSubmit: (extra: StageChangeExtraInput) => void;
  onCancel: () => void;
}

export function StageChangeModal({
  stageName,
  stageSlug,
  requiredFields,
  rejectionReasons,
  processingReasons = [],
  loading,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const needsCallback = requiredFields.includes("callbackAt");
  const needsRejection = requiredFields.includes("rejectionReasonId");
  const needsProcessing = stageSlug === "in_progress";
  const needsPartialPayment = stageSlug === "partial_payment";
  const needsFullPayment = stageSlug === "paid";
  const needsPayment = needsPartialPayment || needsFullPayment;

  const [callbackAt, setCallbackAt] = useState("");
  const [rejectionReasonId, setRejectionReasonId] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [processingStatus, setProcessingStatus] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  const handleSubmit = () => {
    onSubmit({
      callbackAt: needsCallback || needsProcessing ? callbackAt || null : undefined,
      rejectionReasonId: needsRejection ? rejectionReasonId || null : undefined,
      rejectionNote: needsRejection ? rejectionNote || null : undefined,
      processingStatus: needsProcessing ? processingStatus || null : undefined,
      paymentAmount: needsPayment && paymentAmount ? Number(paymentAmount) : undefined,
    });
  };

  const canSubmit =
    (!needsCallback || !!callbackAt) &&
    (!needsRejection || !!rejectionReasonId) &&
    (!needsProcessing || !!processingStatus) &&
    (!needsPartialPayment || Number(paymentAmount) >= 100000);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div className="card relative z-10 w-full max-w-md rounded-b-none sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            «{stageName}» bosqichiga o&apos;tkazish
          </h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {needsCallback && (
            <div>
              <label className="label">Qachon qayta bog&apos;lanish *</label>
              <DateTimeQuick value={callbackAt} onChange={setCallbackAt} />
            </div>
          )}

          {needsProcessing && (
            <>
              <div>
                <label className="label">Qayta ishlash holati *</label>
                <select className="input" value={processingStatus} onChange={(e) => setProcessingStatus(e.target.value)}>
                  <option value="">Tanlang...</option>
                  {processingReasons.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Qayta aloqa vaqti (ixtiyoriy)</label>
                <DateTimeQuick value={callbackAt} onChange={setCallbackAt} />
              </div>
            </>
          )}

          {needsRejection && (
            <>
              <div>
                <label className="label">Rad etish sababi *</label>
                <select
                  className="input"
                  value={rejectionReasonId}
                  onChange={(e) => setRejectionReasonId(e.target.value)}
                >
                  <option value="">Tanlang...</option>
                  {rejectionReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Izoh (ixtiyoriy)</label>
                <textarea
                  className="input min-h-20"
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Qo'shimcha izoh..."
                />
              </div>
            </>
          )}

          {needsPayment && (
            <>
              <div>
                <label className="label">
                  To&apos;lov summasi (so&apos;m){needsPartialPayment ? " *" : ""}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  className="input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={needsPartialPayment ? "Kamida 100 000" : "0 (agar oldin to'langan bo'lsa)"}
                />
                {needsPartialPayment && (
                  <p className="mt-1 text-xs text-slate-400">Qisman to&apos;lov kamida 100 000 so&apos;m</p>
                )}
                {needsFullPayment && (
                  <p className="mt-1 text-xs text-slate-400">
                    Oldingi to&apos;lovlar avtomatik hisobga olinadi
                  </p>
                )}
              </div>
            </>
          )}

          {!needsCallback && !needsRejection && !needsPayment && !needsProcessing && (
            <p className="text-sm text-slate-500">
              Ushbu bosqichga o&apos;tkazishni tasdiqlaysizmi?
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onCancel} className="btn-secondary flex-1">
            Bekor qilish
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="btn-primary flex-1"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}
