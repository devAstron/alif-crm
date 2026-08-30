import { sha256 } from "@/lib/crypto";

/**
 * Meta Conversions API (CAPI) mijozi.
 * Access Token faqat server tomonda ishlatiladi, hech qachon loglanmaydi.
 */

const GRAPH_VERSION = "v21.0";

export interface CapiSettingsResolved {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
}

export interface CapiLeadData {
  id: string;
  name: string;
  phone: string;
  externalLeadId: string | null;
  fbc: string | null;
  fbp: string | null;
  value?: number | null; // Purchase uchun (so'm)
}

export interface CapiSendResult {
  ok: boolean;
  httpStatus: number | null;
  response: string; // xavfsiz (token yo'q)
  error: string | null;
  transient: boolean; // qayta urinishga arziydimi
}

/** Telefonni E.164 raqamlarga tozalab, SHA-256 hash qiladi. */
function hashPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return sha256(digits);
}

/** Meta uchun event payload (user_data hashlangan — xavfsiz). */
export function buildPayload(
  eventName: string,
  lead: CapiLeadData,
  eventId: string,
  actionSource = "system_generated",
) {
  const userData: Record<string, unknown> = {
    ph: [hashPhone(lead.phone)],
    external_id: [sha256(lead.id)],
  };
  if (lead.fbc) userData.fbc = lead.fbc;
  if (lead.fbp) userData.fbp = lead.fbp;

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: actionSource,
    user_data: userData,
  };

  if (eventName === "Purchase" && lead.value != null) {
    event.custom_data = { value: lead.value, currency: "UZS" };
  }

  return { data: [event] };
}

/** Meta CAPI ga event yuboradi. Token URL query'da — loglanmaydi. */
export async function sendCapiEvent(
  settings: CapiSettingsResolved,
  eventName: string,
  lead: CapiLeadData,
  eventId: string,
): Promise<{ result: CapiSendResult; payloadSafe: unknown }> {
  const payload = buildPayload(eventName, lead, eventId);
  const body: Record<string, unknown> = { ...payload };
  if (settings.testEventCode) body.test_event_code = settings.testEventCode;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${settings.pixelId}/events?access_token=${encodeURIComponent(
    settings.accessToken,
  )}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const transient = res.status >= 500 || res.status === 429;
    return {
      result: {
        ok: res.ok,
        httpStatus: res.status,
        response: text.slice(0, 2000),
        error: res.ok ? null : `HTTP ${res.status}`,
        transient,
      },
      payloadSafe: payload, // user_data allaqachon hashlangan
    };
  } catch (e) {
    return {
      result: {
        ok: false,
        httpStatus: null,
        response: "",
        error: e instanceof Error ? e.message : "Tarmoq xatosi",
        transient: true,
      },
      payloadSafe: payload,
    };
  }
}
