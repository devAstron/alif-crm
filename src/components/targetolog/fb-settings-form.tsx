"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Plug, RefreshCw } from "lucide-react";
import { saveFbSettingsAction, testFbConnectionAction, runAdSyncAction } from "@/lib/actions/fb-actions";
import { formatTashkent } from "@/lib/datetime";
import type { FbSettingsView } from "@/lib/facebook/queries";

export function FbSettingsForm({ initial }: { initial: FbSettingsView }) {
  const router = useRouter();
  const [adAccountId, setAdAccountId] = useState(initial.adAccountId);
  const [accessToken, setAccessToken] = useState("");
  const [apiVersion, setApiVersion] = useState(initial.apiVersion);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();
  const [syncing, startSync] = useTransition();

  function submit() {
    setError(null);
    setInfo(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveFbSettingsAction({ adAccountId, accessToken: accessToken || undefined, apiVersion, enabled });
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

  function test() {
    setError(null);
    setInfo(null);
    startTest(async () => {
      const res = await testFbConnectionAction();
      if (res.ok) setInfo(res.data?.message ?? "Ulanish muvaffaqiyatli");
      else setError(res.error ?? "Ulanish xatosi");
    });
  }

  function sync() {
    setError(null);
    setInfo(null);
    startSync(async () => {
      const res = await runAdSyncAction();
      if (res.ok) {
        setInfo(res.data?.message ?? "Sinxronlandi");
        router.refresh();
      } else {
        setError(res.error ?? "Sinxronlash xatosi");
      }
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Facebook Marketing API</h3>
        {initial.lastSyncAt && (
          <span className="text-xs text-slate-400">Oxirgi sinxron: {formatTashkent(initial.lastSyncAt)}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Ad Account ID</label>
          <input className="input" value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="act_1234567890 yoki 1234567890" />
        </div>
        <div>
          <label className="label">Access Token (ads_read)</label>
          <input
            type="password"
            className="input"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={initial.hasAccessToken ? "•••• o'rnatilgan (o'zgartirish uchun yangi kiriting)" : "Token kiriting"}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label">API versiyasi</label>
          <input className="input" value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} placeholder="v21.0" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Yoqilgan (kunlik avtomatik sinxron 05:00)
          </label>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-3 text-sm text-green-600">{info}</p>}
      {initial.lastSyncError && !info && !error && (
        <p className="mt-3 text-sm text-amber-600">Oxirgi xato: {initial.lastSyncError}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={submit} disabled={pending} className="btn-primary">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Saqlash
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600"><Check className="h-4 w-4" /> Saqlandi</span>
        )}
        <button onClick={test} disabled={testing || !initial.hasAccessToken} className="btn-secondary">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Ulanishni tekshirish
        </button>
        <button onClick={sync} disabled={syncing || !initial.enabled} className="btn-secondary">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Kechani sinxronlash
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Reklama sarfi Facebook&apos;dan USD&apos;da olinadi va o&apos;sha kundagi Markaziy bank kursi bo&apos;yicha so&apos;mga o&apos;giriladi.
      </p>
    </div>
  );
}
