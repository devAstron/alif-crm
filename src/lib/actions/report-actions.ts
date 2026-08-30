"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { AUDIT } from "@/lib/constants";
import { toActionError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati noto'g'ri"),
  adSpend: z.number().int().min(0).max(100_000_000_000),
});

/** Kunlik reklama sarfini kiritish/yangilash (Targetolog yoki Admin). */
export async function saveAdSpendAction(input: {
  date: string;
  adSpend: number;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "TARGETOLOG");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  }

  try {
    const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
    const amount = BigInt(parsed.data.adSpend);

    await prisma.marketingReport.upsert({
      where: { date },
      create: { date, adSpend: amount, createdById: user.id, updatedById: user.id },
      update: { adSpend: amount, updatedById: user.id },
    });

    const ip = await getClientIp();
    await writeAudit({
      userId: user.id,
      action: AUDIT.SETTINGS_UPDATE,
      entity: "MarketingReport",
      entityId: parsed.data.date,
      newData: { date: parsed.data.date, adSpend: parsed.data.adSpend },
      ip,
    });

    revalidatePath("/reports");
    revalidatePath("/targetolog");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
