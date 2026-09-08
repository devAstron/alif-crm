"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { assertLeadAccess } from "@/lib/leads/access";
import { AUDIT } from "@/lib/constants";
import { DomainError, toActionError, type ActionResult } from "@/lib/errors";
import {
  isR2Configured,
  uploadReceipt,
  deleteReceipt,
  getReceiptViewUrl,
  ALLOWED_RECEIPT_TYPES,
  MAX_RECEIPT_SIZE,
} from "@/lib/storage/r2";

/** To'lovga chek/hujjat biriktirish (ixtiyoriy). Rasm yoki PDF, 10MB gacha. */
export async function attachReceiptAction(paymentId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  if (!isR2Configured()) return { ok: false, error: "Fayl saqlash sozlanmagan" };

  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new DomainError("not_found", "To'lov topilmadi.");
    await assertLeadAccess(user, payment.leadId);

    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Fayl tanlanmagan" };
    if (!ALLOWED_RECEIPT_TYPES[file.type]) {
      return { ok: false, error: "Faqat rasm (JPG/PNG/WEBP) yoki PDF qabul qilinadi" };
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      return { ok: false, error: "Fayl hajmi 10MB dan oshmasin" };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const oldKey = payment.proofUrl;
    const key = await uploadReceipt(paymentId, bytes, file.type);

    await prisma.payment.update({ where: { id: paymentId }, data: { proofUrl: key } });
    if (oldKey) await deleteReceipt(oldKey).catch(() => {}); // eski faylni tozalash, xato bo'lsa e'tiborsiz

    await writeAudit({
      userId: user.id,
      action: AUDIT.PAYMENT_UPDATE,
      entity: "Payment",
      entityId: paymentId,
      newData: { receiptAttached: true },
      ip: await getClientIp(),
    });

    revalidatePath(`/leads/${payment.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Biriktirilgan chekni o'chirish. */
export async function removeReceiptAction(paymentId: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN", "OPERATOR");
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new DomainError("not_found", "To'lov topilmadi.");
    await assertLeadAccess(user, payment.leadId);
    if (!payment.proofUrl) return { ok: true };

    await deleteReceipt(payment.proofUrl).catch(() => {});
    await prisma.payment.update({ where: { id: paymentId }, data: { proofUrl: null } });

    await writeAudit({
      userId: user.id,
      action: AUDIT.PAYMENT_UPDATE,
      entity: "Payment",
      entityId: paymentId,
      newData: { receiptRemoved: true },
      ip: await getClientIp(),
    });

    revalidatePath(`/leads/${payment.leadId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Chekni ko'rish uchun qisqa muddatli havola (kirish huquqi tekshirilgach). */
export async function getReceiptUrlAction(paymentId: string): Promise<ActionResult<{ url: string }>> {
  const user = await requireRole("ADMIN", "OPERATOR", "TARGETOLOG");
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new DomainError("not_found", "To'lov topilmadi.");
    await assertLeadAccess(user, payment.leadId);
    if (!payment.proofUrl) return { ok: false, error: "Chek biriktirilmagan" };

    const url = await getReceiptViewUrl(payment.proofUrl);
    return { ok: true, data: { url } };
  } catch (error) {
    return toActionError(error);
  }
}
