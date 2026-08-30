import { PrismaClient, CustomFieldType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_STAGES, STAGE } from "../src/lib/constants";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function main() {
  console.log("🌱 Seed boshlandi...");

  // ---- Foydalanuvchilar (DEV credentials — productionda almashtiring!) ----
  const users = [
    { name: "Administrator", login: "admin", password: "admin123", role: "ADMIN" as const },
    { name: "Targetolog", login: "targetolog", password: "target123", role: "TARGETOLOG" as const },
    { name: "Operator Ali", login: "operator1", password: "operator123", role: "OPERATOR" as const },
    { name: "Operator Vali", login: "operator2", password: "operator123", role: "OPERATOR" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { name: u.name, role: u.role, isActive: true },
      create: {
        name: u.name,
        login: u.login,
        role: u.role,
        passwordHash: await hash(u.password),
      },
    });
    console.log(`  ✓ Foydalanuvchi: ${u.login} (${u.role})`);
  }

  // ---- Default pipeline ----
  const pipeline = await prisma.pipeline.upsert({
    where: { slug: "sales" },
    update: { name: "Savdo voronkasi", isDefault: true },
    create: { name: "Savdo voronkasi", slug: "sales", isDefault: true },
  });
  console.log(`  ✓ Pipeline: ${pipeline.name}`);

  // ---- Bosqichlar ----
  // Ba'zi bosqichlar uchun mantiqiy majburiy fieldlar (business rules)
  const requiredByStage: Record<string, string[]> = {
    [STAGE.CALLBACK]: ["callbackAt"],
    [STAGE.REJECTED]: ["rejectionReasonId"],
    [STAGE.QUALIFIED]: ["name", "phone"],
  };

  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const s = DEFAULT_STAGES[i];
    await prisma.pipelineStage.upsert({
      where: { pipelineId_slug: { pipelineId: pipeline.id, slug: s.slug } },
      update: {
        name: s.name,
        color: s.color,
        sortOrder: i,
        isSystem: s.isSystem,
        isActive: true,
      },
      create: {
        pipelineId: pipeline.id,
        name: s.name,
        slug: s.slug,
        color: s.color,
        sortOrder: i,
        isSystem: s.isSystem,
        requiredFields: requiredByStage[s.slug] ?? [],
      },
    });
  }
  console.log(`  ✓ ${DEFAULT_STAGES.length} ta bosqich`);

  // ---- Rad etish sabablari ----
  const reasons = [
    { name: "Narx sababli rad etdi", slug: "price" },
    { name: "Mavjud bo'lmagan raqam", slug: "unreachable_number" },
    { name: "Noto'g'ri raqam", slug: "wrong_number" },
    { name: "Aloqa o'rnatilmadi", slug: "no_contact" },
    { name: "O'zi ariza qoldirmagan", slug: "not_self" },
    { name: "Hozir o'qishga vaqti yo'q", slug: "no_time" },
    { name: "Keyinroq o'qiydi", slug: "later" },
    { name: "Boshqa kursni tanladi", slug: "chose_other" },
    { name: "Faqat narx bilan qiziqdi", slug: "price_inquiry_only" },
    { name: "Boshqa sabab", slug: "other" },
  ];
  for (let i = 0; i < reasons.length; i++) {
    await prisma.rejectionReason.upsert({
      where: { slug: reasons[i].slug },
      update: { name: reasons[i].name, sortOrder: i, isActive: true },
      create: { name: reasons[i].name, slug: reasons[i].slug, sortOrder: i },
    });
  }
  console.log(`  ✓ ${reasons.length} ta rad etish sababi`);

  // ---- Qayta ishlash holati sabablari ----
  const procReasons = [
    { name: "Telegramdan yozildi", slug: "telegram_written" },
    { name: "Ma'lumot berildi", slug: "info_given" },
    { name: "O'ylab ko'radi", slug: "thinking" },
    { name: "Narxi so'raldi", slug: "price_asked" },
    { name: "Keyinroq bog'lanadi", slug: "contact_later" },
    { name: "Boshqa", slug: "other" },
  ];
  for (let i = 0; i < procReasons.length; i++) {
    await prisma.processingReason.upsert({
      where: { slug: procReasons[i].slug },
      update: { name: procReasons[i].name, sortOrder: i, isActive: true },
      create: { name: procReasons[i].name, slug: procReasons[i].slug, sortOrder: i },
    });
  }
  console.log(`  ✓ ${procReasons.length} ta qayta ishlash holati`);

  // ---- Namunaviy custom fieldlar ----
  const customFields = [
    {
      name: "Qo'ng'iroq uchun qulay vaqt",
      slug: "call_time",
      type: CustomFieldType.TEXT,
      options: [] as string[],
      sortOrder: 0,
    },
    {
      name: "Ijtimoiy tarmoq",
      slug: "social_network",
      type: CustomFieldType.SELECT,
      options: ["Instagram", "Telegram", "Facebook", "Boshqa"],
      sortOrder: 1,
    },
  ];
  for (const cf of customFields) {
    await prisma.customField.upsert({
      where: { slug: cf.slug },
      update: { name: cf.name, options: cf.options, sortOrder: cf.sortOrder, isActive: true },
      create: {
        name: cf.name,
        slug: cf.slug,
        type: cf.type,
        options: cf.options,
        sortOrder: cf.sortOrder,
      },
    });
  }
  console.log(`  ✓ ${customFields.length} ta namunaviy custom field`);

  // ---- CAPI settings singleton ----
  await prisma.capiSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  console.log("  ✓ CAPI settings (singleton)");

  console.log("✅ Seed yakunlandi.");
}

main()
  .catch((e) => {
    console.error("❌ Seed xatosi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
