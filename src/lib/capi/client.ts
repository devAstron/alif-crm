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
  secondPhone?: string | null;
  externalLeadId: string | null; // Meta leadgen ID (user_data.lead_id — reklamaga bog'lash)
  fbc: string | null;
  fbp: string | null;
  value?: number | null; // Purchase uchun (so'm)
  // Qo'shimcha (custom_data) — biznes parametrlari
  profession?: string | null;
  languageLevel?: string | null;
  campaignName?: string | null;
  adName?: string | null;
  source?: string | null;
}

export interface CapiSendResult {
  ok: boolean;
  httpStatus: number | null;
  response: string; // xavfsiz (token yo'q)
  error: string | null;
  transient: boolean; // qayta urinishga arziydimi
}

/** Telefonni E.164 raqamlarga normallashtiradi (O'zbekiston kodi bilan). */
function normalizePhoneDigits(phone: string): string {
  let d = phone.replace(/[^\d]/g, "");
  if (d.length === 9) d = "998" + d; // 953511551 -> 998953511551
  else if (d.length === 12 && d.startsWith("998")) { /* to'g'ri */ }
  else if (d.length === 13 && d.startsWith("998")) d = d.slice(0, 12); // ortiqcha raqam
  return d;
}

/** Meta uchun event payload (user_data hashlangan — xavfsiz). */
export function buildPayload(
  eventName: string,
  lead: CapiLeadData,
  eventId: string,
  actionSource = "system_generated",
) {
  // Telefon(lar) — asosiy + ikkinchi raqam, normallashtirilib SHA-256 hashlanadi
  const phoneHashes = Array.from(
    new Set(
      [lead.phone, lead.secondPhone]
        .filter((p): p is string => !!p)
        .map((p) => normalizePhoneDigits(p))
        .filter((d) => d.length >= 9)
        .map((d) => sha256(d)),
    ),
  );

  const userData: Record<string, unknown> = {
    ph: phoneHashes,
    external_id: [sha256(lead.id)],
  };
  // Ism (fn) — birinchi so'z, kichik harf, hashlangan
  const fn = lead.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (fn) userData.fn = [sha256(fn)];
  // Meta leadgen ID — konversiyani aynan reklamaga bog'laydi (hashlanmaydi).
  // 17 xonali son JS Number'da aniqligini yo'qotadi — string sifatida yuboriladi.
  if (lead.externalLeadId) userData.lead_id = lead.externalLeadId;
  if (lead.fbc) userData.fbc = lead.fbc;
  if (lead.fbp) userData.fbp = lead.fbp;

  // custom_data — biznes parametrlari (hashlanmaydi)
  const customData: Record<string, unknown> = { lead_event_source: "Alif CRM" };
  if (eventName === "Purchase" && lead.value != null) {
    customData.value = lead.value;
    customData.currency = "UZS";
  }
  if (lead.profession) customData.profession = lead.profession;
  if (lead.languageLevel) customData.language_level = lead.languageLevel;
  if (lead.campaignName) customData.campaign_name = lead.campaignName;
  if (lead.adName) customData.ad_name = lead.adName;
  if (lead.source) customData.lead_source = lead.source;

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: actionSource,
    user_data: userData,
    custom_data: customData,
  };

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
