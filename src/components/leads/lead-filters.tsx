"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Download, SlidersHorizontal } from "lucide-react";
import { sourceLabel } from "@/lib/format";

interface Props {
  operators: { id: string; name: string }[];
  sources: string[];
  canExport: boolean;
  isAdmin: boolean;
}

export function LeadFilters({ operators, sources, canExport, isAdmin }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const [operatorId, setOperatorId] = useState(params.get("operatorId") ?? "");
  const [source, setSource] = useState(params.get("source") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [payment, setPayment] = useState(params.get("payment") ?? "");

  const activePreset = params.get("datePreset") ?? "all";

  function apply(extra?: Record<string, string>) {
    const sp = new URLSearchParams();
    const q2 = extra?.q ?? q;
    if (q2) sp.set("q", q2);
    if (operatorId) sp.set("operatorId", operatorId);
    if (source) sp.set("source", source);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (payment) sp.set("payment", payment);
    if (activePreset !== "all") sp.set("datePreset", activePreset);
    router.push(`${pathname}?${sp.toString()}`);
  }

  // Kun preseti — boshqa filtrlarni saqlab, faqat datePreset'ni o'zgartiradi
  function setPreset(p: "all" | "today" | "yesterday") {
    const sp = new URLSearchParams(params.toString());
    if (p === "all") sp.delete("datePreset");
    else sp.set("datePreset", p);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function clear() {
    setQ(""); setOperatorId(""); setSource(""); setFrom(""); setTo(""); setPayment("");
    router.push(pathname);
  }

  const exportHref = `/api/export/leads?${params.toString()}`;
  const hasFilters = !!(params.get("q") || params.get("operatorId") || params.get("source") || params.get("from") || params.get("to") || params.get("payment") || params.get("datePreset"));

  const PRESETS: { key: "all" | "today" | "yesterday"; label: string }[] = [
    { key: "all", label: "Butun davr" },
    { key: "today", label: "Bugun" },
    { key: "yesterday", label: "Kecha" },
  ];

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition ${
              activePreset === p.key
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Ism yoki telefon bo'yicha qidirish..."
          />
        </div>
        <button onClick={() => setOpen((v) => !v)} className={`btn-secondary ${open ? "bg-slate-100" : ""}`}>
          <SlidersHorizontal className="h-4 w-4" /> Filtrlar
        </button>
        {hasFilters && (
          <button onClick={clear} className="btn-ghost"><X className="h-4 w-4" /> Tozalash</button>
        )}
        {canExport && (
          <a href={exportHref} className="btn-secondary"><Download className="h-4 w-4" /> Export</a>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          {isAdmin && (
            <div>
              <label className="label">Operator</label>
              <select className="input" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                <option value="">Barchasi</option>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Manba</label>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Barchasi</option>
              {sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To&apos;lov</label>
            <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="">Barchasi</option>
              <option value="any">To&apos;lov qilganlar</option>
              <option value="none">To&apos;lov qilmaganlar</option>
            </select>
          </div>
          <div>
            <label className="label">Sanadan</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Sanagacha</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={() => apply()} className="btn-primary w-full">Qo&apos;llash</button>
          </div>
        </div>
      )}
    </div>
  );
}
