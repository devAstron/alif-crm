import { prisma } from "@/lib/prisma";
import { getDefaultPipeline } from "@/lib/pipeline";
import { writeAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { AUDIT, STAGE } from "@/lib/constants";
import type { IncomingLeadInput } from "./schemas";
import type { InquirySource, Lead, Prisma } from "@prisma/client";

/** source satridan "Zayafka manbasi" enumini aniqlaydi. */
function inquirySourceFrom(source: string | undefined): InquirySource {
  const s = (source ?? "").toLowerCase();
  if (s.includes("target")) return "TARGET";
  if (s.includes("comment")) return "INSTAGRAM_COMMENT";
  if (s.includes("direct")) return "INSTAGRAM_DIRECT";
  if (s.includes("instagram") || s.includes(" ig") || s === "ig") return "INSTAGRAM_DIRECT";
  if (s.includes("referral") || s.includes("tanish")) return "REFERRAL";
  return "OTHER";
}

interface CreateOptions {
  idempotencyKey?: string | null;
  ip?: string | null;
}

interface CreateResult {
  lead: Lead;
  duplicate: boolean;
}

/**
 * Kiruvchi lead yaratadi (tashqi API orqali).
 *  - Idempotency: bir xil kalit bo'lsa mavjud leadni qaytaradi
 *  - "Ko'rib chiqilmagan" (unprocessed) bosqichiga tushadi, operatorga biriktirilmaydi
 *  - Sarlavha avtomatik: "{manba}: {name}-{phone}"
 *  - Dublikatlar bloklanmaydi (bir odam qayta ariza qoldirsa yangi lead)
 */
export async function createIncomingLead(
  input: IncomingLeadInput,
  opts: CreateOptions = {},
): Promise<CreateResult> {
  const idempotencyKey = opts.idempotencyKey?.trim() || null;

  // Idempotency tekshiruvi
  if (idempotencyKey) {
    const existing = await prisma.lead.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { lead: existing, duplicate: true };
    }
  }

  const pipeline = await getDefaultPipeline();
  const unprocessed = pipeline.stages.find((s) => s.slug === STAGE.UNPROCESSED);
  if (!unprocessed) {
    throw new Error("'Ko'rib chiqilmagan' bosqichi topilmadi.");
  }

  const phone = normalizePhone(input.phone);
  const secondPhone = input.second_phone ? normalizePhone(input.second_phone) : null;
  const inquirySource = inquirySourceFrom(input.source);
  const manba = input.source?.trim() || "Ariza";
  const title = `${manba}: ${input.name}-${phone}`;

  // Custom field slug -> id (faqat faol fieldlar)
  const customFieldSlugs = input.custom ? Object.keys(input.custom) : [];
  const customFields = customFieldSlugs.length
    ? await prisma.customField.findMany({
        where: { slug: { in: customFieldSlugs }, isActive: true },
      })
    : [];

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        title,
        name: input.name,
        phone,
        secondPhone,
        inquirySource,
        arabicLevel: input.language_level ?? null,
        activity: input.activity ?? null,
        city: input.city ?? null,
        profession: input.profession ?? null,
        goal: input.goal ?? null,
        note: input.note ?? null,
        externalLeadId: input.lead_id ?? null,
        adId: input.ad_id ?? null,
        adsetId: input.adset_id ?? null,
        campaignId: input.campaign_id ?? null,
        formId: input.form_id ?? null,
        campaignName: input.campaign_name ?? null,
        adsetName: input.adset_name ?? null,
        adName: input.ad_name ?? null,
        utmSource: input.utm_source ?? null,
        utmMedium: input.utm_medium ?? null,
        utmCampaign: input.utm_campaign ?? null,
        utmContent: input.utm_content ?? null,
        utmTerm: input.utm_term ?? null,
        fbc: input.fbc ?? null,
        fbp: input.fbp ?? null,
        landingPage: input.landing_page ?? null,
        source: input.source ?? null,
        field1: input.field1 ?? null,
        field2: input.field2 ?? null,
        field3: input.field3 ?? null,
        cookies: (input.cookies as Prisma.InputJsonValue) ?? undefined,
        idempotencyKey,
        pipelineId: pipeline.id,
        stageId: unprocessed.id,
        stageChangedAt: new Date(),
      },
    });

    // Custom field qiymatlari
    for (const cf of customFields) {
      const raw = input.custom?.[cf.slug];
      if (raw === undefined || raw === null || raw === "") continue;
      await tx.customFieldValue.create({
        data: {
          leadId: created.id,
          fieldId: cf.id,
          value: raw as Prisma.InputJsonValue,
        },
      });
    }

    return created;
  });

  // Audit tranzaksiyadan keyin (Neon latency uchun qisqa tranzaksiya)
  await writeAudit({
    userId: null, // tashqi API — system
    action: AUDIT.LEAD_CREATE,
    entity: "Lead",
    entityId: lead.id,
    newData: { title, name: lead.name, phone: lead.phone, source: lead.source },
    ip: opts.ip,
  });

  return { lead, duplicate: false };
}
