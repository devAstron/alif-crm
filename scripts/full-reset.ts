/**
 * TO'LIQ TOZALASH (0 GA RESET) — QAYTARIB BO'LMAYDI.
 *
 * O'CHIRILADI: barcha leadlar, to'lovlar, pul qaytarishlar, vazifalar, izohlar,
 *   custom qiymatlar, CAPI eventlar, bildirishnomalar, audit tarixi, reklama
 *   insightlari, marketing hisobotlar, valyuta kurslari tarixi — va bitta
 *   ADMIN'dan tashqari BARCHA foydalanuvchilar.
 * SAQLANADI: bitta ko'rsatilgan ADMIN, pipeline+bosqichlar, custom field
 *   ta'riflari, rad/qayta ishlash sabablari, CAPI/FB sozlamalari (API kalitlar).
 *
 * ⚠️ Bu skriptni ishga tushirishdan OLDIN albatta
 *    `npm run db:full-backup` orqali zaxira olib, yuklab olib tasdiqlang!
 *
 * Ishga tushirish (Railway Console orqali production'da):
 *   RESET_CONFIRM=YES-DELETE-EVERYTHING KEEP_ADMIN_LOGIN=admin npx tsx scripts/full-reset.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const keepLogin = process.env.KEEP_ADMIN_LOGIN;

  if (process.env.RESET_CONFIRM !== "YES-DELETE-EVERYTHING" || !keepLogin) {
    console.log("⚠️  Bu BARCHA leadlar/to'lovlar/foydalanuvchilarni QAYTARIB BO'LMAYDIGAN tarzda o'chiradi.");
    console.log("    Avval zaxira oling: npm run db:full-backup");
    console.log("    Keyin tasdiqlash uchun (o'zingizning admin login'ingiz bilan):");
    console.log('    RESET_CONFIRM=YES-DELETE-EVERYTHING KEEP_ADMIN_LOGIN=<login> npx tsx scripts/full-reset.ts\n');
    process.exit(1);
  }

  const keepAdmin = await prisma.user.findUnique({ where: { login: keepLogin } });
  if (!keepAdmin) {
    console.error(`❌ '${keepLogin}' login'i bilan foydalanuvchi topilmadi. To'xtatildi — hech narsa o'chirilmadi.`);
    process.exit(1);
  }
  if (keepAdmin.role !== "ADMIN") {
    console.error(`❌ '${keepLogin}' ADMIN emas (roli: ${keepAdmin.role}). To'xtatildi — hech narsa o'chirilmadi.`);
    process.exit(1);
  }

  console.log(`✅ Saqlanadigan admin: ${keepAdmin.name} (${keepAdmin.login})\n`);
  console.log("🧹 Tozalash boshlandi...\n");

  const c: Record<string, number> = {};
  c["Pul qaytarishlar"] = (await prisma.refund.deleteMany({})).count;
  c["To'lovlar"] = (await prisma.payment.deleteMany({})).count;
  c["Vazifalar"] = (await prisma.task.deleteMany({})).count;
  c["Izohlar"] = (await prisma.comment.deleteMany({})).count;
  c["Custom qiymatlar"] = (await prisma.customFieldValue.deleteMany({})).count;
  c["CAPI eventlar"] = (await prisma.capiEvent.deleteMany({})).count;
  c["Bildirishnomalar"] = (await prisma.notification.deleteMany({})).count;
  c["Leadlar"] = (await prisma.lead.deleteMany({})).count;
  c["Reklama insightlari"] = (await prisma.adInsight.deleteMany({})).count;
  c["Marketing hisobotlar"] = (await prisma.marketingReport.deleteMany({})).count;
  c["Valyuta kurslari"] = (await prisma.fxRate.deleteMany({})).count;
  c["Audit yozuvlari"] = (await prisma.auditLog.deleteMany({})).count;
  // Foydalanuvchilar — kept admin'dan tashqari hammasi (Session/TelegramAccount cascade o'chadi)
  c["Foydalanuvchilar"] = (await prisma.user.deleteMany({ where: { id: { not: keepAdmin.id } } })).count;

  for (const [k, v] of Object.entries(c)) console.log(`  ✓ ${k}: ${v} ta o'chirildi`);

  const usersLeft = await prisma.user.findMany({ select: { login: true, role: true } });
  const stagesLeft = await prisma.pipelineStage.count();
  console.log(`\n✅ Tozalash tugadi. Qolgan foydalanuvchilar: ${JSON.stringify(usersLeft)}`);
  console.log(`   Saqlangan sozlamalar: ${stagesLeft} pipeline bosqichi va boshqa barcha Settings.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Xato:", e);
  process.exit(1);
});
