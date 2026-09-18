"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, requireLeadAccess } from "@/lib/auth";
import { getDefaultPipeline } from "@/lib/pipeline";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { getClientIp } from "@/lib/request";
import { changeLeadStage } from "@/lib/leads/transitions";
import { fireCapiForStage } from "@/lib/capi/service";
import { assertLeadAccess } from "@/lib/leads/access";
import { normalizePhone } from "@/lib/phone";
import { AUDIT, STAGE } from "@/lib/constants";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

const editSchema = z.object({
  leadId: z.string().min(1),
  name: z.string().trim().min(1, "Ism kerak").max(200),
  phone: z.string().trim().min(3, "Telefon kerak").max(50),
  secondPhone: z.string().trim().max(50).optional().nullable(),
  arabicLevel: z.string().trim().max(200).optional().nullable(),
  activity: z.string().trim().max(200).optional().nullable(),
  tariff: z.string().trim().max(200).optional().nullable(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  city: z.string().trim().max(200).optional().nullable(),
  profession: z.string().trim().max(200).optional().nullable(),
  interestLevel: z.string().trim().max(200).optional().nullable(),
  goal: z.string().trim().max(1000).optional().nullable(),
  inquirySource: z.enum(["TARGET", "INSTAGRAM_DIRECT", "INSTAGRAM_COMMENT", "REFERRAL", "OTHER"]),
  dealAmount: z.number().int().min(0).max(100_000_000_000).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  field1: z.string().trim().max(1000).optional().nullable(),
  field2: z.string().trim().max(1000).optional().nullable(),
  field3: z.string().trim().max(1000).optional().nullable(),
  customUpdates: z.record(z.string(), z.unknown()).optional(),
});

export type EditLeadInput = z.infer<typeof editSchema>;

/** Lead maydonlarini tahrirlash (Admin yoki leadga kirish huquqi bor operator). */
export async function updateLeadFieldsAction(input: EditLeadInput): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }
  const d = parsed.data;

  try {
    const lead = await assertLeadAccess(user, d.leadId);
    const ip = await getClientIp();
    const phone = normalizePhone(d.phone);
    const secondPhone = d.secondPhone ? normalizePhone(d.secondPhone) : null;
    const title = `${lead.source?.trim() || "Ariza"}: ${d.name}-${phone}`;

    // Custom fieldlarni oldindan olamiz
    const customSlugs = d.customUpdates ? Object.keys(d.customUpdates) : [];
    const customFields = customSlugs.length
      ? await prisma.customField.findMany({ where: { slug: { in: customSlugs }, isActive: true } })
      : [];

    await prisma.lead.update({
      where: { id: d.leadId },
      data: {
        name: d.name,
        phone,
        secondPhone,
        arabicLevel: d.arabicLevel || null,
        activity: d.activity || null,
        tariff: d.tariff || null,
        age: d.age ?? null,
        gender: d.gender ?? null,
        city: d.city || null,
        profession: d.profession || null,
        interestLevel: d.interestLevel || null,
        goal: d.goal || null,
        inquirySource: d.inquirySource,
        dealAmount: d.dealAmount != null ? BigInt(d.dealAmount) : null,
        note: d.note || null,
        field1: d.field1 || null,
        field2: d.field2 || null,
        field3: d.field3 || null,
        title,
      },
    });

    // Custom qiymatlarni yangilash
    for (const f of customFields) {
      const val = d.customUpdates?.[f.slug];
      if (val === undefined) continue;
      if (val === null || val === "") {
        await prisma.customFieldValue.deleteMany({ where: { leadId: d.leadId, fieldId: f.id } });
      } else {
        await prisma.customFieldValue.upsert({
          where: { leadId_fieldId: { leadId: d.leadId, fieldId: f.id } },
          create: { leadId: d.leadId, fieldId: f.id, value: val as Prisma.InputJsonValue },
          update: { value: val as Prisma.InputJsonValue },
        });
      }
    }

    await writeAudit({
      userId: user.id,
      action: AUDIT.LEAD_FIELD_UPDATE,
      entity: "Lead",
      entityId: d.leadId,
      newData: { name: d.name, phone, fields: "updated" },
      ip,
    });

    revalidatePath(`/leads/${d.leadId}`);
    revalidatePath("/leads");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

export interface MoveStageInput {
  leadId: string;
  toStageId: string;
  callbackAt?: string | null;
  rejectionReasonId?: string | null;
  rejectionNote?: string | null;
  processingStatus?: string | null;
  paymentAmount?: number | null;
  paymentNote?: string | null;
  customUpdates?: Record<string, unknown>;
}

/** Lead bosqichini o'zgartirish (Kanban drag&drop yoki lead detaldan). */
export async function moveLeadStageAction(
  input: MoveStageInput,
): Promise<ActionResult<{ paymentId: string | null }>> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const ip = await getClientIp();

  try {
    await changeLeadStage(user, input.leadId, input.toStageId, {
      callbackAt:
        input.callbackAt === undefined
          ? undefined
          : input.callbackAt
            ? new Date(input.callbackAt)
            : null,
      rejectionReasonId: input.rejectionReasonId ?? undefined,
      rejectionNote: input.rejectionNote ?? undefined,
      processingStatus: input.processingStatus ?? undefined,
      paymentAmount: input.paymentAmount ?? undefined,
      paymentNote: input.paymentNote ?? undefined,
      customUpdates: input.customUpdates,
      ip,
    });
    revalidatePath("/leads");
    revalidatePath(`/leads/${input.leadId}`);

    // Shu o'tishda yangi to'lov yaratilgan bo'lsa — uning ID'sini qaytaramiz
    // (chekni shu yerdan darhol biriktirish uchun, StageChangeModal'da).
    let paymentId: string | null = null;
    if (input.paymentAmount != null && input.paymentAmount > 0) {
      const latest = await prisma.payment.findFirst({
        where: { leadId: input.leadId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      paymentId = latest?.id ?? null;
    }

    return { ok: true, data: { paymentId } };
  } catch (error) {
    return toActionError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Ism kerak").max(200),
  phone: z.string().trim().min(3, "Telefon kerak").max(50),
  secondPhone: z.string().trim().max(50).optional().nullable(),
  source: z.string().trim().max(100).optional().nullable(),
  inquirySource: z.enum(["TARGET", "INSTAGRAM_DIRECT", "INSTAGRAM_COMMENT", "REFERRAL", "OTHER"]).optional().default("OTHER"),
  arabicLevel: z.string().trim().max(200).optional().nullable(),
  activity: z.string().trim().max(200).optional().nullable(),
  profession: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(200).optional().nullable(),
  tariff: z.string().trim().max(200).optional().nullable(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  interestLevel: z.string().trim().max(200).optional().nullable(),
  goal: z.string().trim().max(1000).optional().nullable(),
  dealAmount: z.number().int().min(0).max(100_000_000_000).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  stageSlug: z.string().trim().max(50).optional().nullable(),
  callbackAt: z.string().trim().max(40).optional().nullable(),
});

export type CreateLeadInput = z.infer<typeof createSchema>;

/**
 * Operator/admin qo'lda yangi lead kiritadi.
 *  - Bosqich tanlanmasa → "Yangi lead" (new_lead).
 *  - Operator yaratsa — leadni avtomatik o'ziga biriktiradi.
 *  - Manba (source) matn sifatida saqlanadi, inquirySource enum bilan birga.
 */
export async function createLeadAction(input: CreateLeadInput): Promise<ActionResult<{ leadId: string }>> {
  const user = await requireLeadAccess();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  const d = parsed.data;
  const ip = await getClientIp();

  try {
    const pipeline = await getDefaultPipeline();
    const wanted = d.stageSlug ? pipeline.stages.find((s) => s.slug === d.stageSlug && s.isActive) : null;
    const stage = wanted ?? pipeline.stages.find((s) => s.slug === STAGE.NEW_LEAD);
    if (!stage) return { ok: false, error: "'Yangi lead' bosqichi topilmadi" };

    const phone = normalizePhone(d.phone);
    const secondPhone = d.secondPhone ? normalizePhone(d.secondPhone) : null;
    const manba = d.source?.trim() || "Qo'lda";
    const title = `${manba}: ${d.name}-${phone}`;
    // Operator yaratsa — o'ziga biriktiriladi
    const assignToSelf = user.role === "OPERATOR";
    const callbackAt = stage.slug === STAGE.CALLBACK && d.callbackAt ? new Date(d.callbackAt) : null;

    const lead = await prisma.lead.create({
      data: {
        title,
        name: d.name,
        phone,
        secondPhone,
        source: manba,
        inquirySource: d.inquirySource,
        arabicLevel: d.arabicLevel || null,
        activity: d.activity || null,
        profession: d.profession || null,
        city: d.city || null,
        tariff: d.tariff || null,
        age: d.age ?? null,
        gender: d.gender ?? null,
        interestLevel: d.interestLevel || null,
        goal: d.goal || null,
        dealAmount: d.dealAmount != null ? BigInt(d.dealAmount) : null,
        note: d.note || null,
        callbackAt,
        pipelineId: pipeline.id,
        stageId: stage.id,
        stageChangedAt: new Date(),
        assignedToId: assignToSelf ? user.id : null,
        assignedAt: assignToSelf ? new Date() : null,
      },
    });

    await writeAudit({
      userId: user.id,
      action: AUDIT.LEAD_CREATE,
      entity: "Lead",
      entityId: lead.id,
      newData: { title, name: lead.name, phone, source: manba, stage: stage.slug, manual: true },
      ip,
    });

    revalidatePath("/leads");
    return { ok: true, data: { leadId: lead.id } };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Leadni "Sifatli lid" deb belgilaydi (checklist tasdig'idan keyin).
 * Meta CAPI QualifiedLead SHU YERDAN yuboriladi (funnel bosqichidan emas).
 */
export async function markQualifiedAction(leadId: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const ip = await getClientIp();
  try {
    const lead = await assertLeadAccess(user, leadId);
    if (lead.qualifiedAt) return { ok: true }; // allaqachon sifatli

    await prisma.lead.update({ where: { id: leadId }, data: { qualifiedAt: new Date() } });
    await writeAudit({
      userId: user.id,
      action: AUDIT.LEAD_UPDATE,
      entity: "Lead",
      entityId: leadId,
      newData: { qualified: true },
      ip,
    });
    // Meta CAPI QualifiedLead (never throws, dedup ichida)
    await fireCapiForStage(leadId, "QUALIFIED_LEAD");

    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Sifatli lid belgisini olib tashlaydi (admin). */
export async function unmarkQualifiedAction(leadId: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  try {
    await prisma.lead.update({ where: { id: leadId }, data: { qualifiedAt: null } });
    await writeAudit({
      userId: user.id,
      action: AUDIT.LEAD_UPDATE,
      entity: "Lead",
      entityId: leadId,
      newData: { qualified: false },
      ip: await getClientIp(),
    });
    revalidatePath(`/leads/${leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Leadni soft-delete qiladi (§23). Operator o'z leadini, admin har qanday
 * leadni. Sabab MAJBURIY — bo'sh/faqat bo'shliqlardan iborat bo'lsa xato
 * qaytaradi (UI'da tugma buni oldindan faolsizlantiradi, bu — ikkilamchi
 * himoya).
 */
export async function deleteLeadAction(leadId: string, reason: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const ip = await getClientIp();
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { ok: false, error: "O'chirish sababini yozish shart" };
  }
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      include: { stage: { select: { slug: true } } },
    });
    if (!lead) throw new DomainError("not_found", "Lead topilmadi.");
    if (user.role === "OPERATOR" && lead.assignedToId !== user.id) {
      throw new DomainError("forbidden", "Bu lead sizga tegishli emas.");
    }
    await prisma.lead.update({
      where: { id: leadId },
      data: { deletedAt: new Date(), deletedById: user.id, deleteReason: trimmedReason },
    });
    await writeAudit({
      userId: user.id,
      action: AUDIT.LEAD_DELETE,
      entity: "Lead",
      entityId: leadId,
      newData: { name: lead.name, reason: trimmedReason },
      ip,
    });
    revalidatePath("/leads");
    revalidatePath("/settings/deleted");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** O'chirilgan leadni tiklaydi (faqat admin, §23). */
export async function restoreLeadAction(leadId: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const ip = await getClientIp();
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: { deletedAt: null, deletedById: null, deleteReason: null },
    });
    await writeAudit({ userId: user.id, action: AUDIT.LEAD_RESTORE, entity: "Lead", entityId: leadId, ip });
    revalidatePath("/leads");
    revalidatePath("/settings/deleted");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Admin leadni boshqa operatorga biriktiradi (§37: audit + bildirishnoma). */
export async function reassignLeadAction(input: {
  leadId: string;
  operatorId: string;
}): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const ip = await getClientIp();
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, deletedAt: null },
      select: { id: true, name: true, assignedToId: true },
    });
    if (!lead) throw new DomainError("not_found", "Lead topilmadi.");

    const operator = await prisma.user.findFirst({
      where: { id: input.operatorId, role: "OPERATOR", isActive: true },
      select: { id: true },
    });
    if (!operator) throw new DomainError("bad_operator", "Operator topilmadi.");

    await prisma.lead.update({
      where: { id: input.leadId },
      data: { assignedToId: operator.id, assignedAt: new Date() },
    });
    await writeAudit({
      userId: admin.id,
      action: AUDIT.LEAD_REASSIGN,
      entity: "Lead",
      entityId: input.leadId,
      oldData: { assignedToId: lead.assignedToId },
      newData: { assignedToId: operator.id },
      ip,
    });
    if (operator.id !== admin.id) {
      await createNotification({
        userId: operator.id,
        type: "LEAD_REASSIGNED",
        title: "Yangi lead biriktirildi",
        body: lead.name,
        leadId: lead.id,
      });
    }
    revalidatePath("/leads");
    revalidatePath(`/leads/${input.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
