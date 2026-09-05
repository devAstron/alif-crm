"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { getClientIp } from "@/lib/request";
import { assertLeadAccess } from "@/lib/leads/access";
import { AUDIT, STAGE } from "@/lib/constants";
import { formatSom } from "@/lib/serialize";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  leadId: z.string().min(1),
  amount: z.number().int().positive("Summa musbat bo'lsin").max(100_000_000_000),
  note: z.string().trim().max(1000).optional(),
  paidAt: z.string().optional(),
});

/** Leadga to'lov qo'shish (mustaqil, bosqich o'zgartirmasdan). */
export async function addPaymentAction(input: {
  leadId: string;
  amount: number;
  note?: string;
  paidAt?: string;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato" };
  }

  try {
    const lead = await assertLeadAccess(user, parsed.data.leadId);
    const ip = await getClientIp();
    const amount = BigInt(parsed.data.amount);
    // To'lov turi — leadning HOZIRGI (shu payt) bosqichiga qarab, DOIMIY
    // sifatida yozib qo'yiladi (keyin bosqich o'zgarsa ham bu o'zgarmaydi).
    const kind = lead.stage.slug === STAGE.PAID ? "FULL" : "PARTIAL";

    const payment = await prisma.payment.create({
      data: {
        leadId: parsed.data.leadId,
        amount,
        kind,
        note: parsed.data.note || null,
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
        createdById: user.id,
      },
    });

    await writeAudit({
      userId: user.id,
      action: AUDIT.PAYMENT_CREATE,
      entity: "Payment",
      entityId: payment.id,
      newData: { leadId: parsed.data.leadId, amount: parsed.data.amount },
      ip,
    });

    // Sotuv bildirishnomasi — biriktirilgan operatorga (o'zi kiritgan bo'lsa ham Telegram uchun)
    const notifyId = lead.assignedToId ?? user.id;
    await createNotification({
      userId: notifyId,
      type: "PAYMENT",
      title: "💰 To'lov qo'shildi",
      body: `${lead.name}: ${formatSom(amount)}`,
      leadId: lead.id,
    });

    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** To'lov summasini/izohini tahrirlash. */
export async function updatePaymentAction(input: {
  paymentId: string;
  amount: number;
  note?: string;
}): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  const amt = z.number().int().positive("Summa musbat bo'lsin").max(100_000_000_000).safeParse(input.amount);
  if (!amt.success) return { ok: false, error: amt.error.issues[0]?.message ?? "Xato" };
  try {
    const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new DomainError("not_found", "To'lov topilmadi.");
    await assertLeadAccess(user, payment.leadId);
    await prisma.payment.update({
      where: { id: input.paymentId },
      data: { amount: BigInt(amt.data), note: input.note?.trim() || null },
    });
    await writeAudit({
      userId: user.id,
      action: AUDIT.PAYMENT_UPDATE,
      entity: "Payment",
      entityId: input.paymentId,
      newData: { amount: amt.data },
      ip: await getClientIp(),
    });
    revalidatePath(`/leads/${payment.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** To'lovni o'chirish. */
export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new DomainError("not_found", "To'lov topilmadi.");
    await assertLeadAccess(user, payment.leadId);
    await prisma.payment.delete({ where: { id: paymentId } });
    await writeAudit({
      userId: user.id,
      action: AUDIT.PAYMENT_UPDATE,
      entity: "Payment",
      entityId: paymentId,
      newData: { deleted: true, amount: Number(payment.amount) },
      ip: await getClientIp(),
    });
    revalidatePath(`/leads/${payment.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
