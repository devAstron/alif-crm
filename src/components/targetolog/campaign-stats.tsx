"use client";

import { useState } from "react";
import { formatSom, formatNumber } from "@/lib/serialize";
import type { CampaignStats, AdStatRow } from "@/lib/analytics/campaigns";

const LEVELS = [
  { key: "campaigns", label: "Kampaniyalar" },
  { key: "adsets", label: "Ad set" },
  { key: "ads", label: "Ad" },
] as const;

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function CampaignStatsView({ data }: { data: CampaignStats }) {
  const [level, setLevel] = useState<(typeof LEVELS)[number]["key"]>("campaigns");
  const rows: AdStatRow[] = data[level];
  const showSpend = data.hasSpendData;

  const totals = rows.reduce(
    (t, r) => ({
      leads: t.leads + r.leads,
      qualified: t.qualified + r.qualified,
      sales: t.sales + r.sales,
      revenue: t.revenue + r.revenue,
      spendUsd: t.spendUsd + r.spendUsd,
      spendUzs: t.spendUzs + r.spendUzs,
      fbLeads: t.fbLeads + r.fbLeads,
    }),
    { leads: 0, qualified: 0, sales: 0, revenue: 0, spendUsd: 0, spendUzs: 0, fbLeads: 0 },
  );
  const totalCpl = totals.leads > 0 ? Math.round(totals.spendUzs / totals.leads) : 0;
  const totalCpa = totals.sales > 0 ? Math.round(totals.spendUzs / totals.sales) : 0;
  const totalRoas = totals.spendUzs > 0 ? totals.revenue / totals.spendUzs : 0;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Reklama kesimida natijalar</h3>
          {!showSpend && (
            <p className="mt-0.5 text-xs text-slate-400">
              Sarf (CPL / CPA / ROAS) uchun Facebook API&apos;ni sozlang
            </p>
          )}
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLevel(l.key)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${level === l.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-5 py-2.5 font-medium">Nomi</th>
              {showSpend && <th className="px-3 py-2.5 text-right font-medium">Sarf</th>}
              <th className="px-3 py-2.5 text-center font-medium">Lead</th>
              {showSpend && <th className="px-3 py-2.5 text-center font-medium" title="Facebook hisoblagan lead">FB lead</th>}
              <th className="px-3 py-2.5 text-center font-medium">Sifatli</th>
              <th className="px-3 py-2.5 text-center font-medium">Sotuv</th>
              <th className="px-4 py-2.5 text-right font-medium">Tushum</th>
              {showSpend && <th className="px-3 py-2.5 text-right font-medium" title="Bir lead narxi">CPL</th>}
              {showSpend && <th className="px-3 py-2.5 text-right font-medium" title="Bir sotuv narxi">CPA</th>}
              {showSpend && <th className="px-3 py-2.5 text-right font-medium" title="Tushum / sarf">ROAS</th>}
              <th className="px-4 py-2.5 text-center font-medium">Konv.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-slate-50 last:border-0">
                <td className="max-w-xs truncate px-5 py-2.5 font-medium text-slate-700" title={r.name}>{r.name}</td>
                {showSpend && <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.spendUsd > 0 ? usd(r.spendUsd) : "—"}</td>}
                <td className="px-3 py-2.5 text-center text-slate-600">{r.leads}</td>
                {showSpend && <td className="px-3 py-2.5 text-center text-slate-400">{r.fbLeads || "—"}</td>}
                <td className="px-3 py-2.5 text-center text-teal-600">{r.qualified}</td>
                <td className="px-3 py-2.5 text-center font-medium text-green-600">{r.sales}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-700">{formatSom(r.revenue)}</td>
                {showSpend && <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.cpl > 0 ? formatSom(r.cpl) : "—"}</td>}
                {showSpend && <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.cpa > 0 ? formatSom(r.cpa) : "—"}</td>}
                {showSpend && <td className={`px-3 py-2.5 text-right font-medium ${r.roas >= 1 ? "text-green-600" : r.roas > 0 ? "text-amber-600" : "text-slate-400"}`}>{r.roas > 0 ? `${r.roas.toFixed(1)}x` : "—"}</td>}
                <td className="px-4 py-2.5 text-center text-brand-700">{r.leads > 0 ? `${r.conversion.toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={showSpend ? 11 : 6} className="px-5 py-8 text-center text-slate-400">Ma&apos;lumot yo&apos;q</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-5 py-3">Jami</td>
                {showSpend && <td className="whitespace-nowrap px-3 py-3 text-right">{usd(totals.spendUsd)}</td>}
                <td className="px-3 py-3 text-center">{formatNumber(totals.leads)}</td>
                {showSpend && <td className="px-3 py-3 text-center text-slate-500">{totals.fbLeads || "—"}</td>}
                <td className="px-3 py-3 text-center text-teal-600">{formatNumber(totals.qualified)}</td>
                <td className="px-3 py-3 text-center text-green-600">{formatNumber(totals.sales)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatSom(totals.revenue)}</td>
                {showSpend && <td className="whitespace-nowrap px-3 py-3 text-right">{totalCpl > 0 ? formatSom(totalCpl) : "—"}</td>}
                {showSpend && <td className="whitespace-nowrap px-3 py-3 text-right">{totalCpa > 0 ? formatSom(totalCpa) : "—"}</td>}
                {showSpend && <td className={`px-3 py-3 text-right ${totalRoas >= 1 ? "text-green-600" : "text-amber-600"}`}>{totalRoas > 0 ? `${totalRoas.toFixed(1)}x` : "—"}</td>}
                <td className="px-4 py-3 text-center">{totals.leads > 0 ? `${((totals.sales / totals.leads) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
