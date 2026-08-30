import { StatCard } from "@/components/stat-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { formatSom, formatNumber } from "@/lib/serialize";
import { STAGE } from "@/lib/constants";
import type { OperatorDashboard } from "@/lib/analytics/operator";

export function OperatorDashboardView({ data }: { data: OperatorDashboard }) {
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <>
      {/* KPI */}
      <h2 className="mb-3 text-sm font-semibold text-slate-700">
        Mening leadlarim <span className="font-normal text-slate-400">· shu davrda biriktirilgan</span>
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Biriktirilgan leadlar" value={formatNumber(data.assignedTotal)} accent="brand" />
        <StatCard label="Yangi lead" value={formatNumber(data.byStage[STAGE.NEW_LEAD] ?? 0)} />
        <StatCard label="Qayta aloqa" value={formatNumber(data.byStage[STAGE.CALLBACK] ?? 0)} accent="amber" />
        <StatCard label="Sifatli lid" value={formatNumber(data.qualifiedCount)} accent="green" />
        <StatCard label="Rad etilgan" value={formatNumber(data.byStage[STAGE.REJECTED] ?? 0)} accent="red" />
        <StatCard label="To'lov kutilmoqda" value={formatNumber(data.byStage[STAGE.PAYMENT_PENDING] ?? 0)} accent="amber" />
        <StatCard label="Qisman to'lov" value={formatNumber(data.byStage[STAGE.PARTIAL_PAYMENT] ?? 0)} />
        <StatCard label="To'liq to'lov" value={formatNumber(data.byStage[STAGE.PAID] ?? 0)} accent="green" />
      </div>

      {/* Sotuvlar */}
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Sotuvlarim</h2>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Sotuvlar soni" value={formatNumber(data.salesCount)} accent="green" />
        <StatCard label="Sotuv summasi" value={formatSom(data.revenue)} accent="green" />
        <StatCard label="Konversiya" value={`${data.conversion.toFixed(1)}%`} accent="brand" />
      </div>

      {/* Grafiklar */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DonutChart title="Bosqichlar bo'yicha taqsimot" data={data.stageDistribution} />
        <BarChart title="Kunlik faoliyat" data={data.daily} />
      </div>

      {/* Voronka */}
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Voronka</h2>
        <div className="space-y-2.5">
          {data.funnel.map((f) => (
            <div key={f.slug} className="flex items-center gap-3">
              <div className="w-32 shrink-0 truncate text-sm text-slate-600">{f.name}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                <div
                  className="flex h-full items-center rounded-md px-2 text-xs font-medium text-white"
                  style={{ width: `${Math.max(6, (f.count / maxFunnel) * 100)}%`, background: f.color }}
                >
                  {f.count}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
