/**
 * TO'LIQ ZAXIRA (BACKUP) — CRM'ni 0 ga tozalashdan OLDIN ishga tushiriladi.
 *
 * Hech narsani O'ZGARTIRMAYDI yoki O'CHIRMAYDI — faqat barcha ma'lumotni
 * o'qib, bitta JSON faylga yig'ib, Cloudflare R2'ga yuklaydi va yuklab olish
 * havolasini chiqaradi (24 soat amal qiladi).
 *
 * Ishga tushirish (Railway Console orqali production'da):
 *   npx tsx scripts/full-backup-export.ts
 */
import { prisma } from "@/lib/prisma";
import { uploadBackupFile, getBackupDownloadUrl, isR2Configured } from "@/lib/storage/r2";

// BigInt/Date qiymatlarni JSON'ga xavfsiz aylantirish
function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

async function main() {
  if (!isR2Configured()) {
    console.error("❌ R2 sozlanmagan (R2_ACCOUNT_ID va h.k. environment variable'lar yo'q). Backup yuklab bo'lmaydi.");
    process.exit(1);
  }

  console.log("📦 Barcha ma'lumotlar o'qilmoqda...\n");

  const [
    users,
    leads,
    payments,
    refunds,
    comments,
    tasks,
    customFieldValues,
    capiEvents,
    notifications,
    auditLogs,
    marketingReports,
    adInsights,
    fxRates,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.lead.findMany(),
    prisma.payment.findMany(),
    prisma.refund.findMany(),
    prisma.comment.findMany(),
    prisma.task.findMany(),
    prisma.customFieldValue.findMany(),
    prisma.capiEvent.findMany(),
    prisma.notification.findMany(),
    prisma.auditLog.findMany(),
    prisma.marketingReport.findMany(),
    prisma.adInsight.findMany(),
    prisma.fxRate.findMany(),
  ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    tables: {
      users,
      leads,
      payments,
      refunds,
      comments,
      tasks,
      customFieldValues,
      capiEvents,
      notifications,
      auditLogs,
      marketingReports,
      adInsights,
      fxRates,
    },
  };

  const counts: Record<string, number> = {
    "Foydalanuvchilar": users.length,
    "Leadlar": leads.length,
    "To'lovlar": payments.length,
    "Pul qaytarishlar": refunds.length,
    "Izohlar": comments.length,
    "Vazifalar": tasks.length,
    "Custom qiymatlar": customFieldValues.length,
    "CAPI eventlar": capiEvents.length,
    "Bildirishnomalar": notifications.length,
    "Audit yozuvlari": auditLogs.length,
    "Marketing hisobotlar": marketingReports.length,
    "Reklama insightlari": adInsights.length,
    "Valyuta kurslari": fxRates.length,
  };

  console.log("Topilgan yozuvlar:");
  for (const [k, v] of Object.entries(counts)) console.log(`  · ${k}: ${v}`);

  const json = JSON.stringify(bundle, jsonReplacer, 2);
  const filename = `alif-crm-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  console.log(`\n☁️  R2'ga yuklanmoqda (${(json.length / 1024 / 1024).toFixed(2)} MB)...`);
  const key = await uploadBackupFile(filename, Buffer.from(json, "utf-8"), "application/json");
  const url = await getBackupDownloadUrl(key, 86400);

  console.log("\n✅ Zaxira tayyor! Quyidagi havoladan 24 soat ichida yuklab oling:\n");
  console.log(url);
  console.log("\n(Bu havolani boshqa hech kimga bermang — u orqali barcha ma'lumotlar yuklab olinishi mumkin.)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Xato:", e);
  process.exit(1);
});
