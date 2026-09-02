import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getUsdToUzsRate } from "@/lib/fx/rate";
import { sendCapiEvent, type CapiSettingsResolved, type CapiLeadData } from "./client";
import type { CapiEventName, Prisma } from "@prisma/client";

/** So'mdagi summani joriy kurs bo'yicha USD'ga aylantiradi (2 kasr). */
async function somToUsd(valueSom: number): Promise<number> {
  const rate = await getUsdToUzsRate();
  return rate > 0 ? Math.round((valueSom / rate) * 100) / 100 : 0;
}

/** Meta event nomi (enum -> Meta string). */
export function metaEventName(kind: CapiEventName): string {
  return kind === "QUALIFIED_LEAD" ? "QualifiedLead" : "Purchase";
}

function eventIdFor(kind: CapiEventName, leadId: string): string {
  return `${kind}:${leadId}`;
}

interface ResolvedSettings extends CapiSettingsResolved {
  qualifiedLeadEnabled: boolean;
  purchaseEnabled: boolean;
}

/** CAPI sozlamalarini o'qib, tokenni deshifrlaydi. Sozlanmagan bo'lsa null. */
export async function getResolvedCapiSettings(): Promise<ResolvedSettings | null> {
  const s = await prisma.capiSettings.findUnique({ where: { id: "singleton" } });
  if (!s || !s.pixelId || !s.accessTokenEnc) return null;
  const accessToken = decryptSecret(s.accessTokenEnc);
  if (!accessToken) return null;
  return {
    pixelId: s.pixelId,
    accessToken,
    testEventCode: s.testEventCode,
    qualifiedLeadEnabled: s.qualifiedLeadEnabled,
    purchaseEnabled: s.purchaseEnabled,
  };
}

/**
 * Bosqich o'zgarishi natijasida CAPI event yuboradi (QualifiedLead / Purchase).
 * HECH QACHON throw qilmaydi — lead transitionini buzmasligi kerak (§16).
 * Dedup: lead.*SentAt yoki mavjud SUCCESS event bo'lsa qayta yubormaydi.
 */
export async function fireCapiForStage(leadId: string, kind: CapiEventName): Promise<void> {
  try {
    const settings = await getResolvedCapiSettings();
    if (!settings) return;
    if (kind === "QUALIFIED_LEAD" && !settings.qualifiedLeadEnabled) return;
    if (kind === "PURCHASE" && !settings.purchaseEnabled) return;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // Dedup
    if (kind === "QUALIFIED_LEAD" && lead.qualifiedLeadSentAt) return;
    if (kind === "PURCHASE" && lead.purchaseSentAt) return;

    let value: number | null = null;
    if (kind === "PURCHASE") {
      const agg = await prisma.payment.aggregate({ where: { leadId }, _sum: { amount: true } });
      value = await somToUsd(Number(agg._sum.amount ?? 0n)); // USD (Meta uchun)
    }

    const leadData: CapiLeadData = {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      secondPhone: lead.secondPhone,
      externalLeadId: lead.externalLeadId,
      fbc: lead.fbc,
      fbp: lead.fbp,
      value,
      profession: lead.profession,
      languageLevel: lead.arabicLevel,
      campaignName: lead.campaignName,
      adName: lead.adName,
      source: lead.source,
    };

    await deliver(kind, leadData, settings);
  } catch (e) {
    // CAPI xatosi transitionni buzmaydi — faqat loglaymiz
    console.error(`[CAPI] fireCapiForStage error lead=${leadId} kind=${kind}`, e);
  }
}

/** Bitta yuborish urinishi + natijani CapiEvent'ga yozish (dedup event_id). */
async function deliver(
  kind: CapiEventName,
  lead: CapiLeadData,
  settings: ResolvedSettings,
  isRetry = false,
): Promise<void> {
  const eventId = eventIdFor(kind, lead.id);
  const metaName = metaEventName(kind);

  // Mavjud event (dedup)
  const existing = await prisma.capiEvent.findUnique({ where: { eventId } });
  if (existing?.status === "SUCCESS" && !isRetry) return;

  const { result, payloadSafe } = await sendCapiEvent(settings, metaName, lead, eventId);

  const data: Prisma.CapiEventUncheckedCreateInput = {
    leadId: lead.id,
    eventName: kind,
    eventId,
    status: result.ok ? "SUCCESS" : "FAILED",
    httpStatus: result.httpStatus ?? undefined,
    requestAt: new Date(),
    response: result.response || null,
    error: result.error,
    payloadSafe: payloadSafe as Prisma.InputJsonValue,
    retryCount: isRetry ? (existing?.retryCount ?? 0) + 1 : existing?.retryCount ?? 0,
    lastRetryAt: isRetry ? new Date() : undefined,
  };

  await prisma.capiEvent.upsert({
    where: { eventId },
    create: data,
    update: {
      status: data.status,
      httpStatus: data.httpStatus,
      requestAt: data.requestAt,
      response: data.response,
      error: data.error,
      payloadSafe: data.payloadSafe,
      retryCount: data.retryCount,
      lastRetryAt: data.lastRetryAt,
    },
  });

  if (result.ok) {
    await prisma.lead.update({
      where: { id: lead.id },
      data:
        kind === "QUALIFIED_LEAD"
          ? { qualifiedLeadSentAt: new Date() }
          : { purchaseSentAt: new Date() },
    });
  } else if (result.transient && !isRetry) {
    // Transient xato — bir marta avtomatik qayta urinish
    await deliver(kind, lead, settings, true);
  }
}

/** Muvaffaqiyatsiz CAPI eventni qo'lda qayta yuborish (Admin/Targetolog). */
export async function retryCapiEvent(capiEventId: string): Promise<{ ok: boolean; error?: string }> {
  const event = await prisma.capiEvent.findUnique({ where: { id: capiEventId }, include: { lead: true } });
  if (!event) return { ok: false, error: "Event topilmadi" };
  const settings = await getResolvedCapiSettings();
  if (!settings) return { ok: false, error: "CAPI sozlanmagan" };

  let value: number | null = null;
  if (event.eventName === "PURCHASE") {
    const agg = await prisma.payment.aggregate({ where: { leadId: event.leadId }, _sum: { amount: true } });
    value = await somToUsd(Number(agg._sum.amount ?? 0n)); // USD (Meta uchun)
  }

  await deliver(
    event.eventName,
    {
      id: event.lead.id,
      name: event.lead.name,
      phone: event.lead.phone,
      secondPhone: event.lead.secondPhone,
      externalLeadId: event.lead.externalLeadId,
      fbc: event.lead.fbc,
      fbp: event.lead.fbp,
      value,
      profession: event.lead.profession,
      languageLevel: event.lead.arabicLevel,
      campaignName: event.lead.campaignName,
      adName: event.lead.adName,
      source: event.lead.source,
    },
    settings,
    true,
  );

  const updated = await prisma.capiEvent.findUnique({ where: { id: capiEventId } });
  return updated?.status === "SUCCESS" ? { ok: true } : { ok: false, error: updated?.error ?? "Yuborilmadi" };
}
