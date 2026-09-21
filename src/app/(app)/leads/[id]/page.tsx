import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Send, Clock } from "lucide-react";
import { requireLeadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeadDetail } from "@/lib/leads/queries";
import { getLeadActivity } from "@/lib/leads/timeline";
import { InfoGrid, type InfoItem } from "@/components/leads/detail-parts";
import { LeadStageSelector } from "@/components/leads/lead-stage-selector";
import { LeadOperatorSelector } from "@/components/leads/lead-operator-selector";
import { LeadComments } from "@/components/leads/lead-comments";
import { LeadTasks } from "@/components/leads/lead-tasks";
import { LeadActivity } from "@/components/leads/lead-activity";
import { LeadPayments } from "@/components/leads/lead-payments";
import { isR2Configured } from "@/lib/storage/r2";
import { LeadDeleteButton } from "@/components/leads/lead-delete-button";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { QualifyButton } from "@/components/leads/qualify-button";
import {
  sourceLabel,
  telHref,
  telegramHref,
  genderLabel,
  inquirySourceLabel,
} from "@/lib/format";
import { formatTashkent } from "@/lib/datetime";
import { formatSom } from "@/lib/serialize";

export const metadata = { title: "Lead — Alif CRM" };

function formatCustomValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Ha" : "Yo'q";
  return String(value);
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireLeadAccess();
  const readOnly = user.role === "TARGETOLOG";

  const [detail, rejectionReasons, processingReasons] = await Promise.all([
    getLeadDetail(user, id),
    prisma.rejectionReason.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.processingReason.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!detail) notFound();
  const { lead, totalPaid, history } = detail;

  const [activity, tasks, payments, operators] = await Promise.all([
    getLeadActivity(id),
    prisma.task.findMany({
      where: { leadId: id },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { leadId: id },
      orderBy: { paidAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        refunds: { orderBy: { refundedAt: "desc" }, include: { createdBy: { select: { name: true } } } },
      },
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { role: "OPERATOR", isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const comments = await prisma.comment.findMany({
    where: { leadId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });
  const commentRows = comments.map((c) => ({
    id: c.id,
    author: c.author.name,
    body: c.body,
    createdAt: c.createdAt,
  }));

  const activeCustomFields = await prisma.customField.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, type: true, options: true },
  });
  const customValues: Record<string, unknown> = {};
  for (const cv of lead.customFieldValues) customValues[cv.field.slug] = cv.value;

  const paymentItems = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    note: p.note,
    paidAt: p.paidAt,
    createdByName: p.createdBy?.name ?? null,
    hasReceipt: !!p.proofUrl,
    refunds: p.refunds.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      reason: r.reason,
      refundedAt: r.refundedAt,
      createdByName: r.createdBy?.name ?? null,
    })),
  }));

  const taskItems = tasks.map((t) => ({
    id: t.id,
    dueAt: t.dueAt,
    note: t.note,
    status: t.status,
    type: t.type,
    assignedToName: t.assignedTo?.name ?? null,
  }));

  const stages = lead.pipeline.stages.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    color: s.color,
    requiredFields: (s.requiredFields as string[]) ?? [],
  }));

  const mainItems: InfoItem[] = [
    { label: "Kurs", value: lead.course },
    { label: "Tarif", value: lead.tariff },
    { label: "Arab tilini bilish darajasi", value: lead.arabicLevel },
    { label: "Faoliyati", value: lead.activity },
    { label: "Yosh", value: lead.age },
    { label: "Jins", value: genderLabel(lead.gender) },
    { label: "Shahar", value: lead.city },
    { label: "Kasb", value: lead.profession },
    { label: "Kursga qiziqish darajasi", value: lead.interestLevel },
    { label: "Maqsadi", value: lead.goal },
    { label: "Zayafka manbasi", value: inquirySourceLabel(lead.inquirySource) },
    ...(lead.processingStatus ? [{ label: "Qayta ishlash holati", value: lead.processingStatus }] : []),
    { label: "Ikkinchi raqam", value: lead.secondPhone },
    { label: "Kelishilgan summa", value: lead.dealAmount ? formatSom(lead.dealAmount) : null },
    { label: "Izoh", value: lead.note },
    ...(lead.rejectionReason ? [{ label: "Rad etish sababi", value: lead.rejectionReason.name }] : []),
    ...(lead.rejectionNote ? [{ label: "Rad etish izohi", value: lead.rejectionNote }] : []),
  ];

  const formItems: InfoItem[] = [
    { label: "Savol 1", value: lead.field1 },
    { label: "Savol 2", value: lead.field2 },
    { label: "Savol 3", value: lead.field3 },
  ];

  const marketingItems: InfoItem[] = [
    { label: "Source", value: sourceLabel(lead.source) },
    { label: "Campaign", value: lead.campaignName ?? lead.campaignId },
    { label: "Ad set", value: lead.adsetName ?? lead.adsetId },
    { label: "Ad", value: lead.adName ?? lead.adId },
    { label: "Form ID", value: lead.formId },
    { label: "Lead ID (FB)", value: lead.externalLeadId },
    { label: "UTM Source", value: lead.utmSource },
    { label: "UTM Medium", value: lead.utmMedium },
    { label: "UTM Campaign", value: lead.utmCampaign },
    { label: "UTM Content", value: lead.utmContent },
    { label: "UTM Term", value: lead.utmTerm },
    { label: "Landing page", value: lead.landingPage },
    { label: "FBC", value: lead.fbc },
    { label: "FBP", value: lead.fbp },
  ];

  const customItems: InfoItem[] = lead.customFieldValues.map((cv) => ({
    label: cv.field.name,
    value: formatCustomValue(cv.value),
  }));

  return (
    <div className="pb-24 lg:pb-0">
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" />
        Mijozlar
      </Link>

      {/* Yuqori qism */}
      <div className="card mb-5 p-5">
        <p className="text-xs text-slate-400">{lead.title}</p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{lead.name}</h1>
            <p className="mt-1 text-sm text-slate-600" dir="ltr">{lead.phone}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>
                Operator:{" "}
                <span className="font-medium text-slate-700">
                  {lead.assignedTo?.name ?? "Biriktirilmagan"}
                </span>
              </span>
              <span>·</span>
              <span>Kelgan: {formatTashkent(lead.createdAt)}</span>
              {lead.callbackAt && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Clock className="h-3.5 w-3.5" />
                    Aloqa: {formatTashkent(lead.callbackAt)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Tezkor amallar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {readOnly && lead.qualifiedAt && (
              <span className="badge bg-teal-50 px-3 py-1.5 text-teal-700">Sifatli lid</span>
            )}
            {!readOnly && (
              <QualifyButton leadId={lead.id} qualified={!!lead.qualifiedAt} isAdmin={user.role === "ADMIN"} />
            )}
            <a href={telHref(lead.phone)} className="btn-primary hidden sm:inline-flex">
              <Phone className="h-4 w-4" />
              Qo&apos;ng&apos;iroq
            </a>
            <a href={telegramHref(lead.phone)} target="_blank" rel="noopener noreferrer" className="btn-secondary hidden sm:inline-flex">
              <Send className="h-4 w-4" />
              Telegram
            </a>
            {!readOnly && (<>
            <LeadEditModal
              lead={{
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                secondPhone: lead.secondPhone,
                arabicLevel: lead.arabicLevel,
                activity: lead.activity,
                tariff: lead.tariff,
                age: lead.age,
                gender: lead.gender,
                city: lead.city,
                profession: lead.profession,
                interestLevel: lead.interestLevel,
                goal: lead.goal,
                inquirySource: lead.inquirySource,
                dealAmount: lead.dealAmount != null ? Number(lead.dealAmount) : null,
                note: lead.note,
                field1: lead.field1,
                field2: lead.field2,
                field3: lead.field3,
              }}
              customFields={activeCustomFields.map((c) => ({
                slug: c.slug,
                name: c.name,
                type: c.type,
                options: (c.options as string[]) ?? [],
              }))}
              customValues={customValues}
            />
            <LeadDeleteButton leadId={lead.id} />
            </>)}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {readOnly ? (
              <div>
                <label className="label">Bosqich</label>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: lead.stage.color }} />
                  <span className="text-sm font-medium text-slate-800">{lead.stage.name}</span>
                </div>
              </div>
            ) : (
              <>
                <LeadStageSelector
                  leadId={lead.id}
                  currentStageId={lead.stageId}
                  stages={stages}
                  rejectionReasons={rejectionReasons}
                  processingReasons={processingReasons}
                  receiptsEnabled={isR2Configured()}
                />
                {user.role === "ADMIN" && (
                  <LeadOperatorSelector
                    leadId={lead.id}
                    currentOperatorId={lead.assignedToId}
                    operators={operators}
                  />
                )}
              </>
            )}
          </div>
          <LeadComments leadId={lead.id} comments={commentRows} readOnly={readOnly} />
        </div>
      </div>

      {/* Ma'lumot bloklari */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <InfoGrid title="Asosiy ma'lumotlar" items={mainItems} />
        {customItems.length > 0 && <InfoGrid title="Qo'shimcha maydonlar" items={customItems} />}
        <InfoGrid title="Forma savollari" items={formItems} />
        <InfoGrid title="Marketing ma'lumotlari" items={marketingItems} />
      </div>

      {/* Telefon tarixi */}
      <div className="card mt-5 p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Shu telefon bo&apos;yicha oldingi arizalar
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Oldingi arizalar topilmadi</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/leads/${h.id}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-700">
                  <span className="h-2 w-2 rounded-full" style={{ background: h.stageColor }} />
                  {h.stageName}
                  {h.lastComment && (
                    <span className="text-slate-400">— {h.lastComment}</span>
                  )}
                </Link>
                <span className="shrink-0 text-xs text-slate-400">{formatTashkent(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Vazifalar, to'lov va faoliyat */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <LeadPayments
            leadId={lead.id}
            payments={paymentItems}
            total={totalPaid}
            readOnly={readOnly}
            receiptsEnabled={isR2Configured()}
            canRefund={user.role === "ADMIN"}
          />
          <LeadTasks leadId={lead.id} tasks={taskItems} readOnly={readOnly} />
        </div>
        <LeadActivity leadId={lead.id} items={activity} readOnly={readOnly} />
      </div>

      {/* Mobil sticky amallar paneli */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <a href={telHref(lead.phone)} className="btn-primary flex-1 py-3">
          <Phone className="h-4 w-4" />
          Qo&apos;ng&apos;iroq
        </a>
        <a href={telegramHref(lead.phone)} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 py-3">
          <Send className="h-4 w-4" />
          Telegram
        </a>
      </div>
    </div>
  );
}
