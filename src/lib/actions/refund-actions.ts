"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { AUDIT } from "@/lib/constants";
import { formatSom } from "@/lib/serialize";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().int().positive("Summa musbat bo'lsin").max(100_000_000_000),
  reason: z.string().trim().min(1, "Qaytarish sababini yozish shart").max(1000),
});

/** To'lovni (to'liq yoki qisman) qaytarish — faqat ADMIN. */
export async function createRefundAction(input: {
  paymentId: string;
  amount: number;
  reason: string;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: parsed.data.paymentId },
      include: { refunds: true, lead: { select: { id: true, name: true, deletedAt: true } } },
    });
    if (!payment || payment.lead.deletedAt) throw new DomainError("not_found", "To'lov topilmadi.");

    const alreadyRefunded = payment.refunds.reduce((s, r) => s + r.amount, 0n);
    const remaining = payment.amount - alreadyRefunded;
    const amount = BigInt(parsed.data.amount);
    if (amount > remaining) {
      throw new DomainError(
        "over_limit",
        `Qaytarish summasi to'lovning qolgan qismidan (${formatSom(remaining)}) katta bo'lishi mumkin emas.`,
      );
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        leadId: payment.leadId,
        amount,
        reason: parsed.data.reason,
        createdById: user.id,
      },
    });

    await writeAudit({
      userId: user.id,
      action: AUDIT.REFUND_CREATE,
      entity: "Refund",
      entityId: refund.id,
      newData: { paymentId: payment.id, leadId: payment.leadId, amount: parsed.data.amount, reason: parsed.data.reason },
      ip: await getClientIp(),
    });

    revalidatePath(`/leads/${payment.leadId}`);
    revalidatePath("/refunds");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
