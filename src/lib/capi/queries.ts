import { prisma } from "@/lib/prisma";

export interface CapiSettingsView {
  pixelId: string;
  datasetName: string;
  testEventCode: string;
  qualifiedLeadEnabled: boolean;
  purchaseEnabled: boolean;
  hasAccessToken: boolean; // token o'rnatilganmi (qiymatning o'zi hech qachon chiqmaydi)
}

/** CAPI sozlamalarini UI uchun (Access Token HECH QACHON qaytarilmaydi). */
export async function getCapiSettingsView(): Promise<CapiSettingsView> {
  const s = await prisma.capiSettings.findUnique({ where: { id: "singleton" } });
  return {
    pixelId: s?.pixelId ?? "",
    datasetName: s?.datasetName ?? "",
    testEventCode: s?.testEventCode ?? "",
    qualifiedLeadEnabled: s?.qualifiedLeadEnabled ?? true,
    purchaseEnabled: s?.purchaseEnabled ?? true,
    hasAccessToken: !!s?.accessTokenEnc,
  };
}

export interface CapiEventView {
  id: string;
  eventName: string;
  status: string;
  httpStatus: number | null;
  error: string | null;
  retryCount: number;
  createdAt: Date;
  leadId: string;
  leadName: string;
  payloadSafe: unknown;
  response: string | null;
}

/** So'nggi CAPI eventlari (log). */
export async function getCapiEvents(limit = 50): Promise<CapiEventView[]> {
  const events = await prisma.capiEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { lead: { select: { name: true } } },
  });
  return events.map((e) => ({
    id: e.id,
    eventName: e.eventName,
    status: e.status,
    httpStatus: e.httpStatus,
    error: e.error,
    retryCount: e.retryCount,
    createdAt: e.createdAt,
    leadId: e.leadId,
    leadName: e.lead.name,
    payloadSafe: e.payloadSafe,
    response: e.response,
  }));
}
