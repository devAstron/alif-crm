import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createIncomingLead } from "@/lib/leads/service";
import { incomingLeadSchema } from "@/lib/leads/schemas";
import { changeLeadStage } from "@/lib/leads/transitions";
import { getStageBySlug } from "@/lib/pipeline";
import { RequiredFieldsError, ForbiddenError } from "@/lib/errors";
import { STAGE } from "@/lib/constants";
import { encryptSecret } from "@/lib/crypto";

// Test telefon oralig'i (+998999...) — normalizePhone bularni o'zgartirmaydi (12 raqam, 998)
const TEST_PREFIX = "+998999";
let phoneCounter = 0;
function nextPhone(): string {
  phoneCounter++;
  return `${TEST_PREFIX}${String(phoneCounter).padStart(6, "0")}`;
}

let operator: { id: string; role: "OPERATOR" };
let operator2: { id: string; role: "OPERATOR" };
const stageIds: Record<string, string> = {};

async function cleanup() {
  const leads = await prisma.lead.findMany({
    where: { phone: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const ids = leads.map((l) => l.id);
  if (ids.length) {
    await prisma.capiEvent.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.task.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.comment.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.customFieldValue.deleteMany({ where: { leadId: { in: ids } } });
    for (const id of ids) await prisma.auditLog.deleteMany({ where: { entity: "Lead", entityId: id } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(async () => {
  const op1 = await prisma.user.findUniqueOrThrow({ where: { login: "operator1" } });
  const op2 = await prisma.user.findUniqueOrThrow({ where: { login: "operator2" } });
  operator = { id: op1.id, role: "OPERATOR" };
  operator2 = { id: op2.id, role: "OPERATOR" };
  for (const slug of Object.values(STAGE)) {
    stageIds[slug] = (await getStageBySlug(slug)).id;
  }
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function makeLead() {
  const { lead } = await createIncomingLead({
    name: "Integ Test",
    phone: nextPhone(),
    source: "facebook",
  });
  return lead;
}

describe("Kiruvchi lead API", () => {
  it("lead 'Ko'rib chiqilmagan'ga tushadi, biriktirilmagan, sarlavha to'g'ri", async () => {
    const lead = await makeLead();
    expect(lead.stageId).toBe(stageIds[STAGE.UNPROCESSED]);
    expect(lead.assignedToId).toBeNull();
    expect(lead.title).toBe(`facebook: Integ Test-${lead.phone}`);
  });

  it("idempotency: bir xil kalit yangi lead yaratmaydi", async () => {
    const key = "idem-" + Date.now();
    const idemPhone = "+998999900001";
    const r1 = await createIncomingLead({ name: "X", phone: idemPhone }, { idempotencyKey: key });
    const r2 = await createIncomingLead({ name: "X", phone: idemPhone }, { idempotencyKey: key });
    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);
    expect(r2.lead.id).toBe(r1.lead.id);
  });

  it("noto'g'ri payload validatsiyadan o'tmaydi", () => {
    const res = incomingLeadSchema.safeParse({ phone: "+998900000000" }); // name yo'q
    expect(res.success).toBe(false);
  });
});

describe("Bosqich o'tishlari", () => {
  it("Ko'rib chiqilmagan → Yangi lead operatorga biriktiradi", async () => {
    const lead = await makeLead();
    const updated = await changeLeadStage(operator, lead.id, stageIds[STAGE.NEW_LEAD]);
    expect(updated.assignedToId).toBe(operator.id);
    expect(updated.assignedAt).not.toBeNull();
  });

  it("operator boshqa operatorning leadini o'zgartira olmaydi", async () => {
    const lead = await makeLead();
    await changeLeadStage(operator, lead.id, stageIds[STAGE.NEW_LEAD]); // op1 oladi
    await expect(
      changeLeadStage(operator2, lead.id, stageIds[STAGE.FIRST_CALL]),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Rad etildi sababsiz bloklanadi, sabab bilan o'tadi", async () => {
    const lead = await makeLead();
    await changeLeadStage(operator, lead.id, stageIds[STAGE.NEW_LEAD]);
    await expect(
      changeLeadStage(operator, lead.id, stageIds[STAGE.REJECTED]),
    ).rejects.toBeInstanceOf(RequiredFieldsError);

    const reason = await prisma.rejectionReason.findFirstOrThrow();
    const updated = await changeLeadStage(operator, lead.id, stageIds[STAGE.REJECTED], {
      rejectionReasonId: reason.id,
    });
    expect(updated.stageId).toBe(stageIds[STAGE.REJECTED]);
    expect(updated.rejectionReasonId).toBe(reason.id);
  });

  it("Qayta aloqa avtomatik vazifa yaratadi", async () => {
    const lead = await makeLead();
    await changeLeadStage(operator, lead.id, stageIds[STAGE.NEW_LEAD]);
    const cb = new Date(Date.now() + 3_600_000);
    await changeLeadStage(operator, lead.id, stageIds[STAGE.CALLBACK], { callbackAt: cb });
    const tasks = await prisma.task.findMany({ where: { leadId: lead.id, type: "CALLBACK" } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assignedToId).toBe(operator.id);
  });
});

describe("To'lovlar", () => {
  it("Qisman to'lov < 100 000 bloklanadi, ≥ 100 000 o'tadi", async () => {
    const lead = await makeLead();
    await changeLeadStage(operator, lead.id, stageIds[STAGE.NEW_LEAD]);
    await expect(
      changeLeadStage(operator, lead.id, stageIds[STAGE.PARTIAL_PAYMENT], { paymentAmount: 50_000 }),
    ).rejects.toBeInstanceOf(RequiredFieldsError);

    await changeLeadStage(operator, lead.id, stageIds[STAGE.PARTIAL_PAYMENT], { paymentAmount: 150_000 });
    const agg = await prisma.payment.aggregate({ where: { leadId: lead.id }, _sum: { amount: true } });
    expect(Number(agg._sum.amount)).toBe(150_000);
  });

  it("To'liq to'lov: oldingi to'lovlar hisobga olinadi, paidAt o'rnatiladi", async () => {
    const lead = await makeLead();
    await changeLeadStage(operator, lead.id, stageIds[STAGE.NEW_LEAD]);
    await changeLeadStage(operator, lead.id, stageIds[STAGE.PARTIAL_PAYMENT], { paymentAmount: 200_000 });
    const updated = await changeLeadStage(operator, lead.id, stageIds[STAGE.PAID], { paymentAmount: 300_000 });
    const agg = await prisma.payment.aggregate({ where: { leadId: lead.id }, _sum: { amount: true } });
    expect(Number(agg._sum.amount)).toBe(500_000);
    expect(updated.paidAt).not.toBeNull();
  });
});

describe("CAPI dedup", () => {
  it("Sifatli lid → QualifiedLead event (dedup: bir marta)", async () => {
    // Soxta CAPI sozlamalari
    await prisma.capiSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", pixelId: "1", accessTokenEnc: encryptSecret("t"), qualifiedLeadEnabled: true, purchaseEnabled: true },
      update: { pixelId: "1", accessTokenEnc: encryptSecret("t"), qualifiedLeadEnabled: true, purchaseEnabled: true },
    });
    try {
      const lead = await makeLead();
      await changeLeadStage(operator, lead.id, stageIds[STAGE.NEW_LEAD]);
      // "Sifatli lid" endi bosqich emas — CAPI to'g'ridan-to'g'ri fire qilinadi (deterministik eventId dedup)
      const { fireCapiForStage } = await import("@/lib/capi/service");
      await fireCapiForStage(lead.id, "QUALIFIED_LEAD");
      await fireCapiForStage(lead.id, "QUALIFIED_LEAD");
      const count = await prisma.capiEvent.count({ where: { leadId: lead.id, eventName: "QUALIFIED_LEAD" } });
      expect(count).toBe(1);
    } finally {
      await prisma.capiSettings.update({ where: { id: "singleton" }, data: { pixelId: null, accessTokenEnc: null } });
    }
  });
});

describe("Soft delete / restore", () => {
  it("o'chirilgan lead ko'rinmaydi, tiklanadi", async () => {
    const lead = await makeLead();
    await prisma.lead.update({ where: { id: lead.id }, data: { deletedAt: new Date() } });
    const active = await prisma.lead.findFirst({ where: { id: lead.id, deletedAt: null } });
    expect(active).toBeNull();
    await prisma.lead.update({ where: { id: lead.id }, data: { deletedAt: null } });
    const restored = await prisma.lead.findFirst({ where: { id: lead.id, deletedAt: null } });
    expect(restored).not.toBeNull();
  });
});
