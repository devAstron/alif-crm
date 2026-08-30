"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { encryptSecret } from "@/lib/crypto";
import { retryCapiEvent } from "@/lib/capi/service";
import { AUDIT } from "@/lib/constants";
import { toActionError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  pixelId: z.string().trim().max(100).optional().default(""),
  accessToken: z.string().trim().max(1000).optional().default(""),
  datasetName: z.string().trim().max(200).optional().default(""),
  testEventCode: z.string().trim().max(100).optional().default(""),
  qualifiedLeadEnabled: z.boolean(),
  purchaseEnabled: z.boolean(),
});

/** CAPI sozlamalarini saqlash. Access Token bo'sh bo'lsa — mavjudi saqlanadi. */
export async function saveCapiSettingsAction(input: {
  pixelId?: string;
  accessToken?: string;
  datasetName?: string;
  testEventCode?: string;
  qualifiedLeadEnabled: boolean;
  purchaseEnabled: boolean;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "TARGETOLOG");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  }
  const d = parsed.data;

  try {
    const data: Record<string, unknown> = {
      pixelId: d.pixelId || null,
      datasetName: d.datasetName || null,
      testEventCode: d.testEventCode || null,
      qualifiedLeadEnabled: d.qualifiedLeadEnabled,
      purchaseEnabled: d.purchaseEnabled,
      updatedById: user.id,
    };
    // Token faqat kiritilgan bo'lsa yangilanadi (shifrlangan holda)
    if (d.accessToken) {
      data.accessTokenEnc = encryptSecret(d.accessToken);
    }

    await prisma.capiSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    const ip = await getClientIp();
    await writeAudit({
      userId: user.id,
      action: AUDIT.CAPI_CONFIG_UPDATE,
      entity: "CapiSettings",
      entityId: "singleton",
      newData: {
        pixelId: d.pixelId,
        datasetName: d.datasetName,
        testEventCode: d.testEventCode,
        qualifiedLeadEnabled: d.qualifiedLeadEnabled,
        purchaseEnabled: d.purchaseEnabled,
        accessTokenChanged: !!d.accessToken,
      },
      ip,
    });

    revalidatePath("/targetolog");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Muvaffaqiyatsiz CAPI eventni qayta yuborish. */
export async function retryCapiEventAction(id: string): Promise<ActionResult> {
  await requireRole("ADMIN", "TARGETOLOG");
  try {
    const res = await retryCapiEvent(id);
    revalidatePath("/targetolog");
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (error) {
    return toActionError(error);
  }
}
