import { requireRole } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics/dashboard";
import { presetRange, type DateRangePreset } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { DateFilter } from "@/components/date-filter";
import { StatCard } from "@/components/stat-card";
import { formatSom, formatNumber } from "@/lib/serialize";
import { Trophy } from "lucide-react";

export const metadata = { title: "Operatorlar — Alif CRM" };

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const { start, end } = presetRange((sp.range as DateRangePreset) ?? "today", sp.from, sp.to);
  const data = await getDashboardData(start, end);

  const totalSales = data.operators.reduce((s, o) => s + o.sales, 0);
  const totalRevenue = data.operators.reduce((s, o) => s + o.revenue, 0);
  const totalAssigned = data.operators.reduce((s, o) => s + o.assigned, 0);
  const avgConversion = totalAssigned > 0 ? (totalSales / totalAssigned) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Operatorlar"
        subtitle="Har bir operatorning savdo va konversiya ko'rsatkichlari"
      />

      <div className="mb-6">
        <DateFilter />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Faol operatorlar" value={formatNumber(data.operators.length)} accent="brand" />
        <StatCard label="Jami sotuvlar" value={formatNumber(totalSales)} accent="green" />
        <StatCard label="Jami tushum" value={formatSom(totalRevenue)} accent="green" />
        <StatCard label="O'rtacha konversiya" value={`${avgConversion.toFixed(1)}%`} accent="brand" />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Operatorlar reytingi</h2>
          <p className="mt-0.5 text-xs text-slate-400">Tushum bo&apos;yicha kamayish tartibida</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-5 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Operator</th>
                <th className="px-3 py-2.5 text-center font-medium">Faoliyat</th>
                <th className="px-3 py-2.5 text-center font-medium">Sifatli</th>
                <th className="px-3 py-2.5 text-center font-medium">Sotuvlar</th>
                <th className="px-4 py-2.5 text-right font-medium">Sotuv summasi</th>
                <th className="px-3 py-2.5 text-center font-medium">Konversiya</th>
                <th className="px-3 py-2.5 text-center font-medium">Rad etilgan</th>
                <th className="px-3 py-2.5 text-center font-medium">Kutilmoqda</th>
                <th className="px-5 py-2.5 text-center font-medium">Qisman</th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map((op, i) => (
                <tr key={op.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 text-slate-400">
                    {i === 0 && op.sales > 0 ? (
                      <Trophy className="h-4 w-4 text-amber-500" />
                    ) : (
                      i + 1
                    )}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-800">{op.name}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{op.assigned}</td>
                  <td className="px-3 py-3 text-center text-teal-600">{op.qualified}</td>
                  <td className="px-3 py-3 text-center text-lg font-semibold text-green-600">{op.sales}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800">
                    {formatSom(op.revenue)}
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-brand-700">{op.conversion.toFixed(1)}%</td>
                  <td className="px-3 py-3 text-center text-red-500">{op.rejected}</td>
                  <td className="px-3 py-3 text-center text-amber-600">{op.paymentPending}</td>
                  <td className="px-5 py-3 text-center text-slate-600">{op.partial}</td>
                </tr>
              ))}
              {data.operators.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-400">
                    Operatorlar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
            {data.operators.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <td colSpan={2} className="px-5 py-3">
                    Jami
                  </td>
                  <td className="px-3 py-3 text-center">{formatNumber(totalAssigned)}</td>
                  <td className="px-3 py-3 text-center text-teal-600">
                    {formatNumber(data.operators.reduce((s, o) => s + o.qualified, 0))}
                  </td>
                  <td className="px-3 py-3 text-center text-green-600">{formatNumber(totalSales)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatSom(totalRevenue)}</td>
                  <td className="px-3 py-3 text-center text-brand-700">{avgConversion.toFixed(1)}%</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Faoliyat = shu davrda operatorga tegishli leadning bosqichi o&apos;zgargan (yoki tushgan/biriktirilgan) soni ·
        Sotuvlar/Sotuv summasi = shu davrda to&apos;langan (paidAt) sotuvlar · Konversiya = sotuvlar / faoliyat.
      </p>
    </>
  );
}
