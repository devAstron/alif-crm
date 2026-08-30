"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PRESETS: { key: string; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "week", label: "Oxirgi 7 kun" },
  { key: "month", label: "Oylik" },
];

export function DateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("range") ?? "today";

  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [showCustom, setShowCustom] = useState(current === "custom");

  function selectPreset(key: string) {
    setShowCustom(false);
    router.push(`${pathname}?range=${key}`);
  }

  function applyCustom() {
    if (from && to) {
      router.push(`${pathname}?range=custom&from=${from}&to=${to}`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => selectPreset(p.key)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            current === p.key
              ? "bg-brand-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => setShowCustom((v) => !v)}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          current === "custom"
            ? "bg-brand-600 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Sana oralig&apos;i
      </button>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
          <input type="date" className="input py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-slate-400">—</span>
          <input type="date" className="input py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
          <button onClick={applyCustom} disabled={!from || !to} className="btn-primary py-1.5">
            Ko&apos;rish
          </button>
        </div>
      )}
    </div>
  );
}
