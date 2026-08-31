"use client";

import { useState } from "react";
import { ChevronRight, CornerDownRight } from "lucide-react";
import { formatSom, formatNumber } from "@/lib/serialize";
import type { CampaignStats, AdStatRow } from "@/lib/analytics/campaigns";

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

type Sel = { id: string; name: string } | null;

export function CampaignStatsView({ data }: { data: CampaignStats }) {
  const [campaign, setCampaign] = useState<Sel>(null);
  const [adset, setAdset] = useState<Sel>(null);
  const showSpend = data.hasSpendData;

  // Joriy daraja: ad set tanlansa → adlar; kampaniya tanlansa → adsetlar; aks holda kampaniyalar
  const level: "campaigns" | "adsets" | "ads" = adset ? "ads" : campaign ? "adsets" : "campaigns";
  const rows: AdStatRow[] =
    level === "ads"
      ? data.ads.filter((a) => a.adsetId === adset!.id)
      : level === "adsets"
        ? data.adsets.filter((a) => a.campaignId === campaign!.id)
        : data.campaigns;

  const clickable = level !== "ads"; // ad — oxirgi daraja

  function onRowClick(r: AdStatRow) {
    if (level === "campaigns") setCampaign({ id: r.key, name: r.name });
    else if (level === "adsets") setAdset({ id: r.key, name: r.name });
  }

  const totals = rows.reduce(
    (t, r) => ({
      leads: t.leads + r.leads, qualified: t.qualified + r.qualified, sales: t.sales + r.sales,
      revenue: t.revenue + r.revenue, spendUsd: t.spendUsd + r.spendUsd, spendUzs: t.spendUzs + r.spendUzs, fbLeads: t.fbLeads + r.fbLeads,
    }),
    { leads: 0, qualified: 0, sales: 0, revenue: 0, spendUsd: 0, spendUzs: 0, fbLeads: 0 },
  );
  const tCpl = totals.fbLeads > 0 ? Math.round(totals.spendUsd / totals.fbLeads) : 0;
  const tCpa = totals.sales > 0 ? Math.round(totals.spendUsd / totals.sales) : 0;
  const tRoas = totals.spendUzs > 0 ? totals.revenue / totals.spendUzs : 0;

  const levelLabel = level === "campaigns" ? "Kampaniyalar" : level === "adsets" ? "Ad setlar" : "Reklamalar";

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Reklama kesimida natijalar</h3>
          {/* Breadcrumb */}
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            <button
              onClick={() => { setCampaign(null); setAdset(null); }}
              className={`rounded px-1.5 py-0.5 ${!campaign ? "font-semibold text-brand-700" : "text-slate-500 hover:bg-slate-100"}`}
            >
              Kampaniyalar
            </button>
            {campaign && (
              <>
                <ChevronRight className="h-3 w-3 text-slate-300" />
                <button
                  onClick={() => setAdset(null)}
                  className={`max-w-[180px] truncate rounded px-1.5 py-0.5 ${!adset ? "font-semibold text-brand-700" : "text-slate-500 hover:bg-slate-100"}`}
                  title={campaign.name}
                >
                  {campaign.name}
                </button>
              </>
            )}
            {adset && (
              <>
                <ChevronRight className="h-3 w-3 text-slate-300" />
                <span className="max-w-[180px] truncate rounded px-1.5 py-0.5 font-semibold text-brand-700" title={adset.name}>
                  {adset.name}
                </span>
              </>
            )}
          </div>
        </div>
        {!showSpend && (
          <p className="text-xs text-slate-400">Sarf uchun Facebook API&apos;ni sozlang</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-5 py-2.5 font-medium">{levelLabel}</th>
              {showSpend && <th className="px-3 py-2.5 text-right font-medium">Sarf</th>}
              <th className="px-3 py-2.5 text-center font-medium">Lead</th>
              {showSpend && <th className="px-3 py-2.5 text-center font-medium" title="Facebook hisoblagan lead">FB lead</th>}
              <th className="px-3 py-2.5 text-center font-medium">Sifatli</th>
              <th className="px-3 py-2.5 text-center font-medium">Sotuv</th>
              <th className="px-4 py-2.5 text-right font-medium">Tushum</th>
              {showSpend && <th className="px-3 py-2.5 text-right font-medium" title="FB lead narxi ($): sarf / FB lead">CPL</th>}
              {showSpend && <th className="px-3 py-2.5 text-right font-medium" title="Bir sotuv narxi ($): sarf / sotuv">CPA</th>}
              {showSpend && <th className="px-3 py-2.5 text-right font-medium" title="Tushum / sarf">ROAS</th>}
              <th className="px-4 py-2.5 text-center font-medium">Konv.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                onClick={clickable ? () => onRowClick(r) : undefined}
                className={`border-b border-slate-50 last:border-0 ${clickable ? "cursor-pointer hover:bg-slate-50" : ""}`}
              >
                <td className="max-w-xs px-5 py-2.5 font-medium text-slate-700" title={r.name}>
                  <span className="flex items-center gap-1.5">
                    {clickable && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                    <span className="truncate">{r.name}</span>
                  </span>
                </td>
                {showSpend && <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.spendUsd > 0 ? usd(r.spendUsd) : "—"}</td>}
                <td className="px-3 py-2.5 text-center text-slate-600">{r.leads}</td>
                {showSpend && <td className="px-3 py-2.5 text-center text-slate-400">{r.fbLeads || "—"}</td>}
                <td className="px-3 py-2.5 text-center text-teal-600">{r.qualified}</td>
                <td className="px-3 py-2.5 text-center font-medium text-green-600">{r.sales}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-700">{formatSom(r.revenue)}</td>
                {showSpend && <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.cpl > 0 ? usd(r.cpl) : "—"}</td>}
                {showSpend && <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.cpa > 0 ? usd(r.cpa) : "—"}</td>}
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
                {showSpend && <td className="whitespace-nowrap px-3 py-3 text-right">{tCpl > 0 ? usd(tCpl) : "—"}</td>}
                {showSpend && <td className="whitespace-nowrap px-3 py-3 text-right">{tCpa > 0 ? usd(tCpa) : "—"}</td>}
                {showSpend && <td className={`px-3 py-3 text-right ${tRoas >= 1 ? "text-green-600" : "text-amber-600"}`}>{tRoas > 0 ? `${tRoas.toFixed(1)}x` : "—"}</td>}
                <td className="px-4 py-3 text-center">{totals.leads > 0 ? `${((totals.sales / totals.leads) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {clickable && rows.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">
          <CornerDownRight className="h-3.5 w-3.5" />
          {level === "campaigns" ? "Kampaniyani bosing — ichidagi ad setlar ochiladi" : "Ad setni bosing — ichidagi reklamalar ochiladi"}
        </div>
      )}
    </div>
  );
}
