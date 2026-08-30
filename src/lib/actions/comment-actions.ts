"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { assertLeadAccess } from "@/lib/leads/access";
import { AUDIT } from "@/lib/constants";
import { toActionError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  leadId: z.string().min(1),
  body: z.string().trim().min(1, "Izoh bo'sh bo'lmasin").max(2000),
});

export async function addCommentAction(input: {
  leadId: string;
  body: string;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  }

  try {
    await assertLeadAccess(user, parsed.data.leadId);
    const ip = await getClientIp();
    const comment = await prisma.comment.create({
      data: { leadId: parsed.data.leadId, authorId: user.id, body: parsed.data.body },
    });
    await writeAudit({
      userId: user.id,
      action: AUDIT.COMMENT_CREATE,
      entity: "Comment",
      entityId: comment.id,
      newData: { leadId: parsed.data.leadId },
      ip,
    });
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
