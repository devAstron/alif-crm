"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { encryptSecret } from "@/lib/crypto";
import { AUDIT } from "@/lib/constants";
import { toActionError, type ActionResult } from "@/lib/errors";
import { getFbConfig, fetchFbInsights } from "@/lib/facebook/marketing";
import { syncAdInsights } from "@/lib/facebook/sync";

const schema = z.object({
  adAccountId: z.string().trim().max(100).optional().default(""),
  accessToken: z.string().trim().max(1000).optional().default(""),
  apiVersion: z.string().trim().max(20).optional().default("v21.0"),
  enabled: z.boolean(),
});

/** Facebook sozlamalarini saqlash. Token bo'sh bo'lsa — mavjudi saqlanadi. */
export async function saveFbSettingsAction(input: {
  adAccountId?: string;
  accessToken?: string;
  apiVersion?: string;
  enabled: boolean;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "TARGETOLOG");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  const d = parsed.data;

  // act_ prefiksini normallashtirish
  let adAccountId = d.adAccountId;
  if (adAccountId && !adAccountId.startsWith("act_")) adAccountId = `act_${adAccountId}`;

  try {
    const data: Record<string, unknown> = {
      adAccountId: adAccountId || null,
      apiVersion: d.apiVersion || "v21.0",
      enabled: d.enabled,
      updatedById: user.id,
    };
    if (d.accessToken) data.accessTokenEnc = encryptSecret(d.accessToken);

    await prisma.fbSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    const ip = await getClientIp();
    await writeAudit({
      userId: user.id,
      action: AUDIT.FB_CONFIG_UPDATE,
      entity: "FbSettings",
      entityId: "singleton",
      newData: { adAccountId, apiVersion: d.apiVersion, enabled: d.enabled, accessTokenChanged: !!d.accessToken },
      ip,
    });

    revalidatePath("/targetolog");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Ulanishni tekshirish: bugungi kun uchun bitta so'rov yuboradi. */
export async function testFbConnectionAction(): Promise<ActionResult<{ message: string }>> {
  await requireRole("ADMIN", "TARGETOLOG");
  try {
    const cfg = await getFbConfig({ requireEnabled: false });
    if (!cfg) return { ok: false, error: "Avval Ad Account ID va tokenni saqlang" };
    const today = new Date().toISOString().slice(0, 10);
    const rows = await fetchFbInsights(cfg, "campaign", today, today);
    return { ok: true, data: { message: `Ulanish muvaffaqiyatli. Bugun ${rows.length} ta kampaniya topildi.` } };
  } catch (error) {
    return toActionError(error);
  }
}

/** Qo'lda sinxronlash (default: kecha). Admin/targetolog. */
export async function runAdSyncAction(
  dateKey?: string,
): Promise<ActionResult<{ message: string; date: string; adSpendUzs: number }>> {
  const user = await requireRole("ADMIN", "TARGETOLOG");
  try {
    const day = dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      ? new Date(`${dateKey}T12:00:00.000+05:00`)
      : new Date(Date.now() - 24 * 60 * 60_000);

    const result = await syncAdInsights(day);
    if (!result.ok) return { ok: false, error: result.error ?? "Sinxronlash muvaffaqiyatsiz" };

    await writeAudit({
      userId: user.id,
      action: AUDIT.FB_SYNC,
      entity: "AdInsight",
      entityId: result.date,
      newData: { rows: result.rows, fbLeads: result.fbLeadsTotal, crmLeads: result.crmLeadsTotal, usdToUzs: result.usdToUzs },
    });

    revalidatePath("/targetolog");
    revalidatePath("/reports");
    return {
      ok: true,
      data: {
        message: `${result.date}: ${result.rows} qator, FB ${result.fbLeadsTotal} / CRM ${result.crmLeadsTotal} lead, kurs ${result.usdToUzs?.toLocaleString("ru-RU")} so'm.`,
        date: result.date,
        adSpendUzs: result.adSpendUzs ?? 0,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}
