"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { saveAdSpendAction } from "@/lib/actions/report-actions";
import { formatSom, formatNumber } from "@/lib/serialize";
import type { ReportData, ReportRow } from "@/lib/analytics/reports";

function money(n: number): string {
  return formatSom(Math.round(n));
}
function dash(n: number, fmt: (x: number) => string): string {
  return n > 0 ? fmt(n) : "—";
}

function AdSpendInput({ date, value }: { date: string; value: number }) {
  const router = useRouter();
  const [val, setVal] = useState(String(value || ""));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const num = Math.trunc(Number(val) || 0);
    if (num === value) return;
    startTransition(async () => {
      const res = await saveAdSpendAction({ date, adSpend: num });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        step={1000}
        className="input w-32 py-1.5 text-right"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="0"
      />
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      {saved && <Check className="h-3.5 w-3.5 text-green-500" />}
    </div>
  );
}

export function ReportsTable({ data }: { data: ReportData }) {
  const { rows, totals } = data;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">Sana</th>
              <th className="px-4 py-3 font-medium">Reklama sarfi</th>
              <th className="px-3 py-3 text-center font-medium">Lead</th>
              <th className="px-3 py-3 text-center font-medium">Sotuv</th>
              <th className="px-4 py-3 text-right font-medium">Tushum</th>
              <th className="px-3 py-3 text-right font-medium">CPL</th>
              <th className="px-3 py-3 text-center font-medium">Konv.</th>
              <th className="px-3 py-3 text-right font-medium">CPA</th>
              <th className="px-3 py-3 text-center font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: ReportRow) => (
              <tr key={r.date} className="border-b border-slate-50 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-700">
                  {r.date.split("-").reverse().join(".")}
                </td>
                <td className="px-4 py-2.5">
                  <AdSpendInput date={r.date} value={r.adSpend} />
                </td>
                <td className="px-3 py-2.5 text-center text-slate-600">{r.leads}</td>
                <td className="px-3 py-2.5 text-center font-medium text-green-600">{r.sales}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-700">{money(r.revenue)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(r.cpl, money)}</td>
                <td className="px-3 py-2.5 text-center text-slate-600">{r.leads > 0 ? `${r.conversion.toFixed(1)}%` : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(r.cpa, money)}</td>
                <td className="px-3 py-2.5 text-center text-brand-700">{dash(r.roas, (x) => `${x.toFixed(2)}x`)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Ma&apos;lumot yo&apos;q</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
              <td className="px-4 py-3">Jami</td>
              <td className="whitespace-nowrap px-4 py-3">{money(totals.adSpend)}</td>
              <td className="px-3 py-3 text-center">{formatNumber(totals.leads)}</td>
              <td className="px-3 py-3 text-center text-green-600">{formatNumber(totals.sales)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">{money(totals.revenue)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right">{dash(totals.cpl, money)}</td>
              <td className="px-3 py-3 text-center">{totals.leads > 0 ? `${totals.conversion.toFixed(1)}%` : "—"}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right">{dash(totals.cpa, money)}</td>
              <td className="px-3 py-3 text-center text-brand-700">{dash(totals.roas, (x) => `${x.toFixed(2)}x`)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
