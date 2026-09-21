import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presetRange, type DateRangePreset } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { DateFilter } from "@/components/date-filter";
import { StatCard } from "@/components/stat-card";
import { formatSom, formatNumber } from "@/lib/serialize";
import { formatTashkent } from "@/lib/datetime";

export const metadata = { title: "Pul qaytarish — Alif CRM" };

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const { start, end } = presetRange((sp.range as DateRangePreset) ?? "today", sp.from, sp.to);

  const refunds = await prisma.refund.findMany({
    where: { refundedAt: { gte: start, lte: end } },
    orderBy: { refundedAt: "desc" },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { name: true } },
      payment: { select: { amount: true, kind: true } },
    },
  });

  const total = refunds.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader title="Pul qaytarish" subtitle="To'lovlarga tegishli qaytarishlar tarixi" />

      <div className="mb-6">
        <DateFilter />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Qaytarishlar soni" value={formatNumber(refunds.length)} accent="red" />
        <StatCard label="Jami qaytarilgan summa" value={formatSom(total)} accent="red" />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Qaytarishlar ro&apos;yxati</h2>
        </div>

        {refunds.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">Bu davrda pul qaytarish bo&apos;lmagan</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {refunds.map((r) => (
              <li key={r.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/leads/${r.lead.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                      {r.lead.name}
                    </Link>
                    <p className="text-xs text-slate-400" dir="ltr">{r.lead.phone}</p>
                    <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">Sabab: {r.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-red-600">−{formatSom(Number(r.amount))}</p>
                    <p className="text-xs text-slate-400">{formatTashkent(r.refundedAt)}</p>
                    {r.createdBy && <p className="text-xs text-slate-400">{r.createdBy.name}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Qaytarish qaysi kunga hisoblanadi = qaytarish amalga oshirilgan kun (refundedAt), to&apos;lov qilingan kundan
        mustaqil. Boshqaruv panelidagi &quot;Sotuv summasi&quot; shu davr to&apos;lovlaridan shu davr qaytarishlari
        ayrilgan holda (sof tushum) ko&apos;rsatiladi.
      </p>
    </>
  );
}
