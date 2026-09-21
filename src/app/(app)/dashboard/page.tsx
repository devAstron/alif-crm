import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/analytics/dashboard";
import { getOperatorDashboardData } from "@/lib/analytics/operator";
import { presetRange, type DateRangePreset } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { DateFilter } from "@/components/date-filter";
import { StatCard } from "@/components/stat-card";
import { OperatorDashboardView } from "@/components/dashboard/operator-dashboard";
import { TelegramActivate } from "@/components/dashboard/telegram-activate";
import { formatSom, formatNumber } from "@/lib/serialize";
import { STAGE } from "@/lib/constants";

export const metadata = { title: "Boshqaruv paneli — Alif CRM" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("ADMIN", "OPERATOR");
  const sp = await searchParams;
  const { start, end } = presetRange((sp.range as DateRangePreset) ?? "today", sp.from, sp.to);

  // --- Operator paneli ---
  if (user.role === "OPERATOR") {
    const [account, opData] = await Promise.all([
      prisma.telegramAccount.findUnique({ where: { userId: user.id } }),
      getOperatorDashboardData(user.id, start, end),
    ]);
    return (
      <>
        <PageHeader title="Boshqaruv paneli" subtitle={`Xush kelibsiz, ${user.name}`} />
        {!account && <TelegramActivate />}
        <div className="mb-6">
          <DateFilter />
        </div>
        <OperatorDashboardView data={opData} />
      </>
    );
  }

  // --- Admin paneli ---
  const data = await getDashboardData(start, end);
  const conv = data.conversion.toFixed(1);
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <>
      <PageHeader title="Boshqaruv paneli" subtitle="Umumiy ko'rsatkichlar" />
      <div className="mb-6">
        <DateFilter />
      </div>

      {/* Lead KPI */}
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Leadlar</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Jami lead" value={formatNumber(data.leadsTotal)} accent="brand" />
        <StatCard label="Yangi lead" value={formatNumber(data.byStage[STAGE.NEW_LEAD] ?? 0)} />
        <StatCard label="Qayta aloqa" value={formatNumber(data.byStage[STAGE.CALLBACK] ?? 0)} />
        <StatCard label="Sifatli lid" value={formatNumber(data.qualifiedCount)} accent="green" />
        <StatCard label="Rad etilgan" value={formatNumber(data.byStage[STAGE.REJECTED] ?? 0)} accent="red" />
        <StatCard label="To'lov kutilmoqda" value={formatNumber(data.byStage[STAGE.PAYMENT_PENDING] ?? 0)} accent="amber" />
        <StatCard label="Qisman to'lov" value={formatNumber(data.byStage[STAGE.PARTIAL_PAYMENT] ?? 0)} />
        <StatCard label="To'liq to'lov" value={formatNumber(data.byStage[STAGE.PAID] ?? 0)} accent="green" />
      </div>

      {/* Sales KPI */}
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Sotuvlar</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Sotuvlar soni" value={formatNumber(data.salesCount)} accent="green" />
        <StatCard label="Sotuv summasi" value={formatSom(data.revenue)} accent="green" sub="Qaytarishlar ayrilgan (sof)" />
        <StatCard label="Konversiya" value={`${conv}%`} accent="brand" />
        <StatCard label="To'liq to'lov summasi" value={formatSom(data.fullPaymentSum)} />
        <StatCard label="Qisman to'lov summasi" value={formatSom(data.partialPaymentSum)} />
        <StatCard label="Qaytarilgan summa" value={formatSom(data.refundedTotal)} accent="red" />
      </div>

      {/* Funnel */}
      <div className="mb-6 card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Voronka</h2>
        <div className="space-y-2.5">
          {data.funnel.map((f) => (
            <div key={f.slug} className="flex items-center gap-3">
              <div className="w-32 shrink-0 truncate text-sm text-slate-600">{f.name}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                <div
                  className="flex h-full items-center rounded-md bg-brand-500 px-2 text-xs font-medium text-white"
                  style={{ width: `${Math.max(6, (f.count / maxFunnel) * 100)}%` }}
                >
                  {f.count}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operator statistikasi */}
      <div className="card overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-700">
          Operatorlar statistikasi
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-5 py-2.5 font-medium">Operator</th>
                <th className="px-3 py-2.5 text-center font-medium">Leadlar</th>
                <th className="px-3 py-2.5 text-center font-medium">Sifatli</th>
                <th className="px-3 py-2.5 text-center font-medium">Rad etilgan</th>
                <th className="px-3 py-2.5 text-center font-medium">Kutilmoqda</th>
                <th className="px-3 py-2.5 text-center font-medium">Qisman</th>
                <th className="px-3 py-2.5 text-center font-medium">Sotuvlar</th>
                <th className="px-5 py-2.5 text-center font-medium">Konversiya</th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map((op) => (
                <tr key={op.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{op.name}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{op.assigned}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{op.qualified}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{op.rejected}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{op.paymentPending}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{op.partial}</td>
                  <td className="px-3 py-3 text-center font-medium text-green-600">{op.sales}</td>
                  <td className="px-5 py-3 text-center text-brand-700">{op.conversion.toFixed(1)}%</td>
                </tr>
              ))}
              {data.operators.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Operatorlar yo&apos;q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
