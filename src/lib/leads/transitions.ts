import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { fireCapiForStage } from "@/lib/capi/service";
import { formatTashkent } from "@/lib/datetime";
import { AUDIT, STAGE, STANDARD_LEAD_FIELDS, MIN_PARTIAL_PAYMENT } from "@/lib/constants";
import { DomainError, ForbiddenError, RequiredFieldsError } from "@/lib/errors";
import { formatSom } from "@/lib/serialize";
import type { Lead, Prisma, Role } from "@prisma/client";

export interface StageChangeExtra {
  callbackAt?: Date | null;
  rejectionReasonId?: string | null;
  rejectionNote?: string | null;
  processingStatus?: string | null;
  paymentAmount?: number | null;
  paymentNote?: string | null;
  customUpdates?: Record<string, unknown>;
  ip?: string | null;
}

type LeadForCheck = Lead & {
  customFieldValues: { field: { slug: string }; value: unknown }[];
};

/** Standart field to'ldirilganmi? */
function isStandardFilled(lead: LeadForCheck, key: string): boolean {
  switch (key) {
    case "name":
      return !!lead.name?.trim();
    case "phone":
      return !!lead.phone?.trim();
    case "arabicLevel":
      return !!lead.arabicLevel;
    case "activity":
      return !!lead.activity;
    case "tariff":
      return !!lead.tariff;
    case "city":
      return !!lead.city;
    case "profession":
      return !!lead.profession;
    case "interestLevel":
      return !!lead.interestLevel;
    case "goal":
      return !!lead.goal;
    case "age":
      return lead.age != null;
    case "gender":
      return lead.gender != null;
    case "dealAmount":
      return lead.dealAmount != null;
    case "callbackAt":
      return lead.callbackAt != null;
    case "rejectionReasonId":
      return !!lead.rejectionReasonId;
    case "inquirySource":
      return lead.inquirySource != null;
    default:
      return true; // noma'lum standart kalitni bloklamaymiz
  }
}

/** Bosqichga o'tish uchun majburiy fieldlarni tekshiradi. */
async function validateRequiredFields(
  requiredKeys: string[],
  prospective: LeadForCheck,
  customValueMap: Map<string, unknown>,
): Promise<void> {
  if (!requiredKeys.length) return;

  const missing: { key: string; label: string }[] = [];
  const standardLabels = new Map(STANDARD_LEAD_FIELDS.map((f) => [f.key, f.label]));

  // Custom field kalitlari uchun label'larni yig'amiz
  const customSlugs = requiredKeys
    .filter((k) => k.startsWith("custom:"))
    .map((k) => k.slice("custom:".length));
  const customFields = customSlugs.length
    ? await prisma.customField.findMany({ where: { slug: { in: customSlugs } } })
    : [];
  const customLabels = new Map(customFields.map((f) => [f.slug, f.name]));

  for (const key of requiredKeys) {
    if (key.startsWith("custom:")) {
      const slug = key.slice("custom:".length);
      const val = customValueMap.get(slug);
      const filled = val !== undefined && val !== null && val !== "" &&
        !(Array.isArray(val) && val.length === 0);
      if (!filled) {
        missing.push({ key, label: customLabels.get(slug) ?? slug });
      }
    } else {
      if (!isStandardFilled(prospective, key)) {
        missing.push({ key, label: standardLabels.get(key) ?? key });
      }
    }
  }

  if (missing.length) throw new RequiredFieldsError(missing);
}

/**
 * Lead bosqichini o'zgartiradi (server-side validatsiya bilan).
 *  - Majburiy fieldlarni tekshiradi
 *  - "Ko'rib chiqilmagan → Yangi lead" da operatorga biriktiradi
 *  - Rad etish sababi / qayta aloqa vaqti kabi extra ma'lumotlarni saqlaydi
 *  - Audit log yozadi
 *
 * Eslatma: qayta aloqa task'i (3-bosqich) va CAPI eventlar (5-bosqich) keyingi
 * bosqichlarda shu funksiyaga ulanadi.
 */
export async function changeLeadStage(
  user: { id: string; role: Role },
  leadId: string,
  toStageId: string,
  extra: StageChangeExtra = {},
): Promise<Lead> {
  const lead = (await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: { customFieldValues: { include: { field: { select: { slug: true } } } } },
  })) as LeadForCheck | null;

  if (!lead) throw new DomainError("not_found", "Lead topilmadi.");

  // Ikkala bosqichni bitta so'rovda olamiz (round-trip'ni kamaytirish)
  const stageIds = Array.from(new Set([lead.stageId, toStageId]));
  const foundStages = await prisma.pipelineStage.findMany({ where: { id: { in: stageIds } } });
  const fromStage = foundStages.find((s) => s.id === lead.stageId) ?? null;
  const toStage = foundStages.find((s) => s.id === toStageId) ?? null;
  if (!toStage || !toStage.isActive) throw new DomainError("bad_stage", "Bosqich noto'g'ri.");
  if (toStage.pipelineId !== lead.pipelineId)
    throw new DomainError("bad_stage", "Bosqich boshqa voronkaga tegishli.");

  // --- Avtorizatsiya (operator doirasi) ---
  if (user.role === "OPERATOR") {
    if (lead.assignedToId && lead.assignedToId !== user.id) {
      throw new ForbiddenError("Bu lead boshqa operatorga biriktirilgan.");
    }
    if (!lead.assignedToId && fromStage?.slug !== STAGE.UNPROCESSED) {
      throw new ForbiddenError("Bu leadni o'zgartirishga ruxsatingiz yo'q.");
    }
  }

  if (toStageId === lead.stageId) return lead; // o'zgarish yo'q

  // --- Prospective holat (extra bilan birlashtirilgan) ---
  const prospective: LeadForCheck = {
    ...lead,
    callbackAt: extra.callbackAt !== undefined ? extra.callbackAt : lead.callbackAt,
    rejectionReasonId:
      extra.rejectionReasonId !== undefined ? extra.rejectionReasonId : lead.rejectionReasonId,
  };

  const customValueMap = new Map<string, unknown>();
  for (const cv of lead.customFieldValues) customValueMap.set(cv.field.slug, cv.value);
  if (extra.customUpdates) {
    for (const [slug, val] of Object.entries(extra.customUpdates)) customValueMap.set(slug, val);
  }

  await validateRequiredFields(
    (toStage.requiredFields as string[]) ?? [],
    prospective,
    customValueMap,
  );

  // --- To'lov bosqichlari qoidalari (§8, §37) ---
  let paymentToCreate: bigint | null = null;
  if (toStage.slug === STAGE.PARTIAL_PAYMENT || toStage.slug === STAGE.PAID) {
    const agg = await prisma.payment.aggregate({ where: { leadId }, _sum: { amount: true } });
    const existingTotal = agg._sum.amount ?? 0n;
    const amt =
      extra.paymentAmount != null && extra.paymentAmount > 0
        ? BigInt(Math.trunc(extra.paymentAmount))
        : 0n;

    if (toStage.slug === STAGE.PARTIAL_PAYMENT) {
      if (amt < MIN_PARTIAL_PAYMENT) {
        throw new RequiredFieldsError([
          { key: "paymentAmount", label: `To'lov summasi (kamida ${formatSom(MIN_PARTIAL_PAYMENT)})` },
        ]);
      }
      paymentToCreate = amt;
    } else {
      // To'lov qildi — jami (oldingi + yangi) > 0 bo'lishi kerak
      if (existingTotal + amt <= 0n) {
        throw new RequiredFieldsError([{ key: "paymentAmount", label: "To'lov summasi" }]);
      }
      if (amt > 0n) paymentToCreate = amt;
    }
  }

  // --- Biriktirish qoidasi ---
  const shouldAssign =
    fromStage?.slug === STAGE.UNPROCESSED &&
    toStage.slug !== STAGE.UNPROCESSED &&
    !lead.assignedToId &&
    user.role === "OPERATOR";

  const now = new Date();

  const updateData: Prisma.LeadUpdateInput = {
    stage: { connect: { id: toStageId } },
    stageChangedAt: now,
  };
  if (extra.callbackAt !== undefined) updateData.callbackAt = extra.callbackAt;
  if (extra.rejectionReasonId !== undefined) {
    updateData.rejectionReason = extra.rejectionReasonId
      ? { connect: { id: extra.rejectionReasonId } }
      : { disconnect: true };
  }
  if (extra.rejectionNote !== undefined) updateData.rejectionNote = extra.rejectionNote;
  if (shouldAssign) {
    updateData.assignedTo = { connect: { id: user.id } };
    updateData.assignedAt = now;
  }
  if (toStage.slug === STAGE.PAID && !lead.paidAt) {
    updateData.paidAt = now;
  }
  // "Qayta ishlashda" holat sababi
  if (toStage.slug === STAGE.IN_PROGRESS && extra.processingStatus !== undefined) {
    updateData.processingStatus = extra.processingStatus;
  }

  // Custom qiymatlar uchun fieldlarni oldindan olib olamiz (tranzaksiyani qisqartirish uchun)
  const customUpdateFields =
    extra.customUpdates && Object.keys(extra.customUpdates).length
      ? await prisma.customField.findMany({
          where: { slug: { in: Object.keys(extra.customUpdates) }, isActive: true },
        })
      : [];

  // Qayta aloqa vaqti belgilangan bo'lsa task yaratamiz (CALLBACK yoki IN_PROGRESS'da)
  const isCallback =
    !!prospective.callbackAt &&
    (toStage.slug === STAGE.CALLBACK || toStage.slug === STAGE.IN_PROGRESS);

  // Tranzaksiya faqat asosiy atomik yozuvlarni bajaradi (Neon latency uchun qisqa)
  const { updated, taskId, assigneeId, paymentId, paymentAmount } = await prisma.$transaction(
    async (tx) => {
      const result = await tx.lead.update({ where: { id: leadId }, data: updateData });

      for (const f of customUpdateFields) {
        const val = extra.customUpdates?.[f.slug];
        if (val === undefined) continue;
        await tx.customFieldValue.upsert({
          where: { leadId_fieldId: { leadId, fieldId: f.id } },
          create: { leadId, fieldId: f.id, value: val as Prisma.InputJsonValue },
          update: { value: val as Prisma.InputJsonValue },
        });
      }

      let taskId: string | null = null;
      let assigneeId: string | null = null;
      if (isCallback) {
        assigneeId = result.assignedToId ?? user.id;
        const task = await tx.task.create({
          data: {
            leadId,
            type: "CALLBACK",
            dueAt: prospective.callbackAt!,
            note: `Qayta aloqa: ${lead.name}`,
            createdById: user.id,
            assignedToId: assigneeId,
          },
        });
        taskId = task.id;
      }

      let paymentId: string | null = null;
      if (paymentToCreate && paymentToCreate > 0n) {
        const payment = await tx.payment.create({
          data: {
            leadId,
            amount: paymentToCreate,
            note: extra.paymentNote || null,
            createdById: user.id,
          },
        });
        paymentId = payment.id;
      }

      return {
        updated: result,
        taskId,
        assigneeId,
        paymentId,
        paymentAmount: paymentToCreate,
      };
    },
    { timeout: 15000 },
  );

  // Audit, bildirishnoma va CAPI commit'dan keyin — parallel (ikkilamchi, transitionni bloklamaydi)
  const jobs: Promise<unknown>[] = [
    writeAudit({
      userId: user.id,
      action: AUDIT.LEAD_STAGE_CHANGE,
      entity: "Lead",
      entityId: leadId,
      oldData: { stage: fromStage?.slug },
      newData: { stage: toStage.slug },
      ip: extra.ip,
    }),
  ];

  if (shouldAssign) {
    jobs.push(
      writeAudit({
        userId: user.id,
        action: AUDIT.LEAD_ASSIGN,
        entity: "Lead",
        entityId: leadId,
        newData: { assignedToId: user.id },
        ip: extra.ip,
      }),
    );
  }
  if (taskId && assigneeId) {
    jobs.push(
      writeAudit({
        userId: user.id,
        action: AUDIT.TASK_CREATE,
        entity: "Task",
        entityId: taskId,
        newData: { leadId, dueAt: prospective.callbackAt, type: "CALLBACK" },
        ip: extra.ip,
      }),
      createNotification({
        userId: assigneeId,
        type: "TASK_NEW",
        title: "Yangi qayta aloqa vazifasi",
        body: `${lead.name} bilan ${formatTashkent(prospective.callbackAt!)} da bog'laning`,
        leadId,
      }),
    );
  }
  if (paymentId && paymentAmount) {
    jobs.push(
      writeAudit({
        userId: user.id,
        action: AUDIT.PAYMENT_CREATE,
        entity: "Payment",
        entityId: paymentId,
        newData: { leadId, amount: Number(paymentAmount) },
        ip: extra.ip,
      }),
    );
    // Sotuv bildirishnomasi — operatorGA (o'zi kiritgan bo'lsa ham Telegram uchun)
    const notifyId = updated.assignedToId ?? user.id;
    const isPartial = toStage.slug === STAGE.PARTIAL_PAYMENT;
    jobs.push(
      createNotification({
        userId: notifyId,
        type: isPartial ? "PARTIAL_PAYMENT" : "PAYMENT",
        title: isPartial ? "💰 Qisman to'lov" : "💰 To'lov qildi",
        body: `${lead.name}: ${formatSom(paymentAmount)}`,
        leadId,
      }),
    );
  }
  // Meta CAPI Purchase (QualifiedLead endi "Sifatli lid" tugmasidan yuboriladi)
  if (toStage.slug === STAGE.PAID) jobs.push(fireCapiForStage(leadId, "PURCHASE"));

  await Promise.all(jobs);

  return updated;
}
