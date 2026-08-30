"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { saveCapiSettingsAction } from "@/lib/actions/capi-actions";
import type { CapiSettingsView } from "@/lib/capi/queries";

export function CapiSettingsForm({ initial }: { initial: CapiSettingsView }) {
  const router = useRouter();
  const [pixelId, setPixelId] = useState(initial.pixelId);
  const [accessToken, setAccessToken] = useState("");
  const [datasetName, setDatasetName] = useState(initial.datasetName);
  const [testEventCode, setTestEventCode] = useState(initial.testEventCode);
  const [qualifiedLeadEnabled, setQL] = useState(initial.qualifiedLeadEnabled);
  const [purchaseEnabled, setPurchase] = useState(initial.purchaseEnabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveCapiSettingsAction({
        pixelId,
        accessToken: accessToken || undefined,
        datasetName,
        testEventCode,
        qualifiedLeadEnabled,
        purchaseEnabled,
      });
      if (res.ok) {
        setSaved(true);
        setAccessToken("");
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error ?? "Xatolik");
      }
    });
  }

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Meta CAPI sozlamalari</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Pixel ID</label>
          <input className="input" value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="Masalan: 123456789012345" />
        </div>
        <div>
          <label className="label">Access Token</label>
          <input
            type="password"
            className="input"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={initial.hasAccessToken ? "•••• o'rnatilgan (o'zgartirish uchun yangi kiriting)" : "Access Token kiriting"}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label">Dataset nomi</label>
          <input className="input" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
        </div>
        <div>
          <label className="label">Test Event Code (ixtiyoriy)</label>
          <input className="input" value={testEventCode} onChange={(e) => setTestEventCode(e.target.value)} placeholder="TEST12345" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={qualifiedLeadEnabled} onChange={(e) => setQL(e.target.checked)} />
          QualifiedLead eventini yuborish (Sifatli lid deb belgilanganda)
        </label>
        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={purchaseEnabled} onChange={(e) => setPurchase(e.target.checked)} />
          Purchase eventini yuborish (To&apos;lov qildi bosqichida)
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button onClick={submit} disabled={pending} className="btn-primary">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Saqlash
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="h-4 w-4" /> Saqlandi
          </span>
        )}
      </div>
    </div>
  );
}
