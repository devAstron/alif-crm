import { formatSom, formatNumber } from "@/lib/serialize";
import type { ReportData, ReportRow } from "@/lib/analytics/reports";

function money(n: number): string {
  return formatSom(Math.round(n));
}
function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
function dash(n: number, fmt: (x: number) => string): string {
  return n > 0 ? fmt(n) : "—";
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
              <th className="px-4 py-3 text-right font-medium">Reklama sarfi</th>
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
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-700">
                  {r.adSpendUsd > 0 ? usd(r.adSpendUsd) : "—"}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-600">{r.leads}</td>
                <td className="px-3 py-2.5 text-center font-medium text-green-600">{r.sales}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-700">{money(r.revenue)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(r.cpl, usd)}</td>
                <td className="px-3 py-2.5 text-center text-slate-600">{r.leads > 0 ? `${r.conversion.toFixed(1)}%` : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{dash(r.cpa, usd)}</td>
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
              <td className="whitespace-nowrap px-4 py-3 text-right">{usd(totals.adSpendUsd)}</td>
              <td className="px-3 py-3 text-center">{formatNumber(totals.leads)}</td>
              <td className="px-3 py-3 text-center text-green-600">{formatNumber(totals.sales)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">{money(totals.revenue)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right">{dash(totals.cpl, usd)}</td>
              <td className="px-3 py-3 text-center">{totals.leads > 0 ? `${totals.conversion.toFixed(1)}%` : "—"}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right">{dash(totals.cpa, usd)}</td>
              <td className="px-3 py-3 text-center text-brand-700">{dash(totals.roas, (x) => `${x.toFixed(2)}x`)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
