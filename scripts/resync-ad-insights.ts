/**
 * Bir martalik: bazada allaqachon saqlangan reklama kunlarini yangi filtr
 * (faqat sotuv/lead kampaniyalari) bilan Facebook'dan qayta sinxronlaydi.
 * Filtrdan o'tmaydigan eski qatorlar (vakansiya, IG qamrov va h.k.) o'chadi,
 * Hisobotlardagi kunlik reklama sarfi (MarketingReport) ham qayta yoziladi.
 *
 * Oraliq: bazadagi eng erta reklama/hisobot kunidan kechagacha (yoki FROM=YYYY-MM-DD).
 *
 * Ishga tushirish (Railway Console):  npx tsx scripts/resync-ad-insights.ts
 * Aniq sanadan:  FROM=2026-10-01 npx tsx scripts/resync-ad-insights.ts
 */
import { prisma } from "@/lib/prisma";
import { syncAdInsights } from "@/lib/facebook/sync";

/** YYYY-MM-DD kunlar ro'yxati (from..to, ikkalasi ham kiradi) */
function dayKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86400e3)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function main() {
  // Boshlanish: FROM=YYYY-MM-DD berilmasa — bazadagi eng erta reklama/hisobot kuni.
  // (Filtr sabab sarfsiz qolgan kunlarda AdInsight qatori bo'lmasligi mumkin, shuning
  // uchun kunlar ro'yxati qatorlardan emas, oraliqdan olinadi.)
  const [firstInsight, firstReport] = await Promise.all([
    prisma.adInsight.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    prisma.marketingReport.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  const candidates = [firstInsight?.date, firstReport?.date].filter((d): d is Date => !!d).map((d) => d.toISOString().slice(0, 10));
  const from = process.env.FROM ?? candidates.sort()[0];
  if (!from) {
    console.log("Sinxronlanadigan kun topilmadi (FROM=YYYY-MM-DD bering).");
    return;
  }
  const to = new Date(Date.now() - 86400e3).toISOString().slice(0, 10); // kecha
  const keys = dayKeys(from, to);
  console.log(`🔄 ${from} … ${to}: ${keys.length} ta kun qayta sinxronlanadi...\n`);

  let failed = 0;
  for (const key of keys) {
    const res = await syncAdInsights(new Date(`${key}T12:00:00+05:00`));
    if (res.ok) {
      console.log(`  ✓ ${key}: ${res.rows} qator, sarf $${((res.adSpendUsd ?? 0) / 100).toFixed(2)}`);
    } else {
      failed++;
      console.log(`  ✗ ${key}: ${res.error}`);
    }
  }

  console.log(failed ? `\n⚠️ ${failed} ta kun xato bilan tugadi — qayta ishga tushirib ko'ring.` : "\n✅ Hammasi tayyor.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Xato:", e);
  process.exit(1);
});
