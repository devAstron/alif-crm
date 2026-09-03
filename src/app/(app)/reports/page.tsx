import { requireRole } from "@/lib/auth";
import { getReportData } from "@/lib/analytics/reports";
import { presetRange, type DateRangePreset } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { DateFilter } from "@/components/date-filter";
import { ReportsTable } from "@/components/reports/reports-table";
import { SyncReportButton } from "@/components/reports/sync-report-button";

export const metadata = { title: "Hisobotlar — Alif CRM" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "TARGETOLOG");
  const sp = await searchParams;
  const { start, end } = presetRange((sp.range as DateRangePreset) ?? "month", sp.from, sp.to);
  const data = await getReportData(start, end);

  return (
    <>
      <PageHeader
        title="Hisobotlar"
        subtitle="Reklama sarfi Facebook'dan avtomatik olinadi — har kuni 05:00'da yangilanadi"
        actions={<SyncReportButton />}
      />
      <div className="mb-6">
        <DateFilter />
      </div>
      <ReportsTable data={data} />
      <p className="mt-4 text-xs text-slate-400">
        CPL = sarf / lead · Konversiya = sotuv / lead · CPA = sarf / sotuv · ROAS = tushum / sarf.
        Reklama sarfi Facebook Marketing API&apos;dan avtomatik olinadi (kunlik kurs bo&apos;yicha so&apos;mga
        o&apos;giriladi); zarur bo&apos;lsa qo&apos;lda ham tuzatish mumkin.
      </p>
    </>
  );
}
