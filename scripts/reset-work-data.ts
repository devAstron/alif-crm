/**
 * Ish ma'lumotlarini tozalash — ishga tushirishdan oldin (test leadlarni o'chirish).
 *
 * O'CHIRILADI: leadlar, to'lovlar, vazifalar, izohlar, custom qiymatlar,
 *   bildirishnomalar, CAPI eventlar, reklama insightlari, marketing hisobotlar, audit.
 * SAQLANADI: foydalanuvchilar, pipeline+bosqichlar, custom field ta'riflari,
 *   rad/qayta ishlash sabablari, CAPI/FB sozlamalari, valyuta kurslari.
 *
 * XAVFSIZLIK: RESET_CONFIRM=YES bo'lmasa ishlamaydi.
 *   Ishga tushirish:  RESET_CONFIRM=YES npm run db:reset-data
 */
import { prisma } from "@/lib/prisma";

async function main() {
  if (process.env.RESET_CONFIRM !== "YES") {
    console.log("⚠️  Bu BARCHA lead/to'lov/vazifa ma'lumotlarini o'chiradi (sozlamalar saqlanadi).");
    console.log("    Tasdiqlash uchun quyidagicha ishga tushiring:");
    console.log("    RESET_CONFIRM=YES npm run db:reset-data\n");
    process.exit(1);
  }

  console.log("🧹 Ish ma'lumotlari tozalanmoqda...\n");
  const c: Record<string, number> = {};
  // Avval lead-ga bog'liq bolalar (cascade bo'lsa ham — aniq sanoq uchun)
  c["To'lovlar"] = (await prisma.payment.deleteMany({})).count;
  c["Vazifalar"] = (await prisma.task.deleteMany({})).count;
  c["Izohlar"] = (await prisma.comment.deleteMany({})).count;
  c["Custom qiymatlar"] = (await prisma.customFieldValue.deleteMany({})).count;
  c["CAPI eventlar"] = (await prisma.capiEvent.deleteMany({})).count;
  c["Bildirishnomalar"] = (await prisma.notification.deleteMany({})).count;
  // Leadlar
  c["Leadlar"] = (await prisma.lead.deleteMany({})).count;
  // Mustaqil jadvallar
  c["Reklama insightlari"] = (await prisma.adInsight.deleteMany({})).count;
  c["Marketing hisobotlar"] = (await prisma.marketingReport.deleteMany({})).count;
  c["Audit yozuvlari"] = (await prisma.auditLog.deleteMany({})).count;

  for (const [k, v] of Object.entries(c)) console.log(`  ✓ ${k}: ${v} ta o'chirildi`);

  const usersLeft = await prisma.user.count();
  const stagesLeft = await prisma.pipelineStage.count();
  console.log(`\n✅ Tozalash tugadi. Saqlangan: ${usersLeft} foydalanuvchi, ${stagesLeft} bosqich, sozlamalar.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Xato:", e); process.exit(1); });
