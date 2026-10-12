import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getUsdToUzsRate } from "@/lib/fx/rate";
import { sendCapiEvent, type CapiSettingsResolved, type CapiLeadData } from "./client";
import type { CapiEventName, Lead, Prisma } from "@prisma/client";

/** So'mdagi summani joriy kurs bo'yicha USD'ga aylantiradi (2 kasr). */
async function somToUsd(valueSom: number): Promise<number> {
  const rate = await getUsdToUzsRate();
  return rate > 0 ? Math.round((valueSom / rate) * 100) / 100 : 0;
}

/** Meta event nomi (enum -> Meta string). */
export function metaEventName(kind: CapiEventName): string {
  return kind === "QUALIFIED_LEAD" ? "QualifiedLead" : "Purchase";
}

function qualifiedEventId(leadId: string): string {
  return `QUALIFIED_LEAD:${leadId}`;
}

/** Purchase har bir TO'LOV uchun alohida event — dedup kaliti to'lov ID'si. */
function purchaseEventId(paymentId: string): string {
  return `PURCHASE:${paymentId}`;
}

interface DeliveryRef {
  eventId: string;
  paymentId?: string | null;
}

function toLeadData(lead: Lead, value: number | null): CapiLeadData {
  return {
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
 * "Sifatli lid" belgilanganda QualifiedLead event yuboradi.
 * HECH QACHON throw qilmaydi (§16). Dedup: lead.qualifiedLeadSentAt yoki mavjud SUCCESS event.
 */
export async function fireCapiForStage(leadId: string, kind: "QUALIFIED_LEAD"): Promise<void> {
  try {
    const settings = await getResolvedCapiSettings();
    if (!settings || !settings.qualifiedLeadEnabled) return;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.qualifiedLeadSentAt) return;

    await deliver(kind, toLeadData(lead, null), settings, { eventId: qualifiedEventId(leadId) });
  } catch (e) {
    // CAPI xatosi asosiy amalni buzmaydi — faqat loglaymiz
    console.error(`[CAPI] fireCapiForStage error lead=${leadId} kind=${kind}`, e);
  }
}

/**
 * Har bir to'lov (qisman ham, to'liq ham) uchun alohida Purchase event yuboradi.
 * Qiymat — AYNAN shu to'lovning summasi (USD): oldingi to'lovlar kiritilmaydi,
 * chunki ular o'z vaqtida o'z eventi bilan yuborilgan. Masalan 200 ming, keyin
 * 237 ming to'langan bo'lsa — Meta'ga 200 ming va 237 ming (437 emas) boradi.
 * HECH QACHON throw qilmaydi. Dedup: eventId = PURCHASE:<paymentId>.
 */
export async function firePurchaseForPayment(paymentId: string): Promise<void> {
  try {
    const settings = await getResolvedCapiSettings();
    if (!settings || !settings.purchaseEnabled) return;

    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { lead: true } });
    if (!payment || payment.lead.deletedAt) return;

    const value = await somToUsd(Number(payment.amount));
    await deliver("PURCHASE", toLeadData(payment.lead, value), settings, {
      eventId: purchaseEventId(paymentId),
      paymentId,
    });
  } catch (e) {
    console.error(`[CAPI] firePurchaseForPayment error payment=${paymentId}`, e);
  }
}

/** Bitta yuborish urinishi + natijani CapiEvent'ga yozish (dedup event_id). */
async function deliver(
  kind: CapiEventName,
  lead: CapiLeadData,
  settings: ResolvedSettings,
  ref: DeliveryRef,
  isRetry = false,
): Promise<void> {
  const { eventId } = ref;
  const metaName = metaEventName(kind);

  // Mavjud event (dedup)
  const existing = await prisma.capiEvent.findUnique({ where: { eventId } });
  if (existing?.status === "SUCCESS" && !isRetry) return;

  const { result, payloadSafe } = await sendCapiEvent(settings, metaName, lead, eventId);

  const data: Prisma.CapiEventUncheckedCreateInput = {
    leadId: lead.id,
    eventName: kind,
    eventId,
    paymentId: ref.paymentId ?? null,
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
    await deliver(kind, lead, settings, ref, true);
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
    if (event.paymentId) {
      // Yangi tartib: shu eventga tegishli to'lov summasi
      const payment = await prisma.payment.findUnique({ where: { id: event.paymentId } });
      if (!payment) return { ok: false, error: "To'lov topilmadi (o'chirilgan) — qayta yuborib bo'lmaydi" };
      value = await somToUsd(Number(payment.amount));
    } else {
      // Eski eventlar (to'lovga bog'lanmagan): lead bo'yicha jami to'lov
      const agg = await prisma.payment.aggregate({ where: { leadId: event.leadId }, _sum: { amount: true } });
      value = await somToUsd(Number(agg._sum.amount ?? 0n));
    }
  }

  await deliver(
    event.eventName,
    toLeadData(event.lead, value),
    settings,
    { eventId: event.eventId, paymentId: event.paymentId },
    true,
  );

  const updated = await prisma.capiEvent.findUnique({ where: { id: capiEventId } });
  return updated?.status === "SUCCESS" ? { ok: true } : { ok: false, error: updated?.error ?? "Yuborilmadi" };
}
