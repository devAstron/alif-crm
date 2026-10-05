/**
 * Bir martalik: bazada allaqachon saqlangan reklama kunlarini yangi filtr
 * (faqat sotuv/lead kampaniyalari) bilan Facebook'dan qayta sinxronlaydi.
 * Filtrdan o'tmaydigan eski qatorlar (vakansiya, IG qamrov va h.k.) o'chadi,
 * Hisobotlardagi kunlik reklama sarfi (MarketingReport) ham qayta yoziladi.
 *
 * Faqat AdInsight'da bor kunlar qayta ishlanadi (qo'lda kiritilgan eski
 * MarketingReport kunlariga tegilmaydi).
 *
 * Ishga tushirish (Railway Console):  npx tsx scripts/resync-ad-insights.ts
 */
import { prisma } from "@/lib/prisma";
import { syncAdInsights } from "@/lib/facebook/sync";

async function main() {
  const days = await prisma.adInsight.findMany({
    distinct: ["date"],
    select: { date: true },
    orderBy: { date: "asc" },
  });
  console.log(`🔄 ${days.length} ta kun qayta sinxronlanadi...\n`);

  let failed = 0;
  for (const { date } of days) {
    const key = date.toISOString().slice(0, 10);
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
