import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDashboardData } from "@/lib/analytics/dashboard";
import { getCampaignStats } from "@/lib/analytics/campaigns";
import { getCapiSettingsView, getCapiEvents } from "@/lib/capi/queries";
import { getFbSettingsView } from "@/lib/facebook/queries";
import { presetRange, type DateRangePreset } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { DateFilter } from "@/components/date-filter";
import { StatCard } from "@/components/stat-card";
import { CapiSettingsForm } from "@/components/capi/capi-settings-form";
import { CapiEventLog } from "@/components/capi/capi-event-log";
import { CampaignStatsView } from "@/components/targetolog/campaign-stats";
import { FbSettingsForm } from "@/components/targetolog/fb-settings-form";
import { formatSom, formatNumber } from "@/lib/serialize";
import { BarChart3 } from "lucide-react";

export const metadata = { title: "Targetolog kabineti — Alif CRM" };

export default async function TargetologPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "TARGETOLOG");
  const sp = await searchParams;
  const { start, end } = presetRange((sp.range as DateRangePreset) ?? "today", sp.from, sp.to);

  const [data, campaignStats, fbSettings, capiSettings, capiEvents] = await Promise.all([
    getDashboardData(start, end),
    getCampaignStats(start, end),
    getFbSettingsView(),
    getCapiSettingsView(),
    getCapiEvents(50),
  ]);

  return (
    <>
      <PageHeader
        title="Targetolog kabineti"
        subtitle="Moliyaviy holat, sotuvlar va Meta CAPI"
        actions={
          <Link href="/reports" className="btn-secondary">
            <BarChart3 className="h-4 w-4" />
            Hisobotlar
          </Link>
        }
      />

      <div className="mb-6">
        <DateFilter />
      </div>

      {/* Moliyaviy holat */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Leadlar" value={formatNumber(data.leadsTotal)} accent="brand" />
        <StatCard label="Sotuvlar" value={formatNumber(data.salesCount)} accent="green" />
        <StatCard label="Tushum" value={formatSom(data.revenue)} accent="green" />
        <StatCard label="Konversiya" value={`${data.conversion.toFixed(1)}%`} accent="brand" />
        <StatCard label="To'liq to'lov" value={formatSom(data.fullPaymentSum)} />
        <StatCard label="Qisman to'lov" value={formatSom(data.partialPaymentSum)} />
      </div>

      {/* Reklama kesimida natijalar */}
      <div className="mb-6">
        <CampaignStatsView data={campaignStats} />
      </div>

      {/* Facebook Marketing API */}
      <div className="mb-6">
        <FbSettingsForm initial={fbSettings} />
      </div>

      {/* CAPI sozlamalari */}
      <div className="mb-6">
        <CapiSettingsForm initial={capiSettings} />
      </div>

      {/* CAPI eventlar jurnali */}
      <CapiEventLog events={capiEvents} />
    </>
  );
}
