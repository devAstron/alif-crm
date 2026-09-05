/**
 * Eski (migratsiyadan oldingi) Payment yozuvlari uchun `kind`ni to'g'irlaydi.
 *
 * Muammo: `kind` maydoni default "FULL" bilan qo'shildi — bu barcha ESKI
 * to'lovlarga (shu jumladan haqiqatan QISMAN bo'lgan to'lovlarga) noto'g'ri
 * yopishtiriladi. Bu skript har lead uchun:
 *   - agar lead.paidAt bo'lmasa (hech qachon to'liq to'lamagan) — barcha
 *     to'lovlari PARTIAL deb belgilanadi;
 *   - agar lead.paidAt bo'lsa — shu sanaga ENG YAQIN to'lov FULL deb, qolgan
 *     barcha (oldingi) to'lovlari PARTIAL deb belgilanadi (chunki tizim har
 *     doim "to'liq to'lov"ni alohida, YANGI yozuv sifatida yaratadi — eng
 *     oxirgi/eng yaqin yozuv aynan o'sha "yakunlovchi" to'lovdir).
 *
 * Xavfsiz: faqat backfill, hech narsani o'chirmaydi. Bir necha marta ishga
 * tushirish mumkin (idempotent).
 *
 * Ishga tushirish:  npm run db:backfill-payment-kind
 */
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("🔧 Payment.kind backfill boshlandi...\n");

  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      paidAt: true,
      payments: { select: { id: true, paidAt: true, kind: true }, orderBy: { paidAt: "asc" } },
    },
    where: { payments: { some: {} } },
  });

  let fixedPartial = 0;
  let fixedFull = 0;
  let unchanged = 0;

  for (const lead of leads) {
    if (lead.payments.length === 0) continue;

    let fullPaymentId: string | null = null;
    if (lead.paidAt) {
      // lead.paidAt'ga eng yaqin (undan oldin yoki teng) to'lov — "yakunlovchi" to'lov
      const candidates = lead.payments.filter((p) => p.paidAt <= lead.paidAt!);
      const chosen = candidates.length > 0 ? candidates[candidates.length - 1] : lead.payments[lead.payments.length - 1];
      fullPaymentId = chosen.id;
    }

    for (const p of lead.payments) {
      const correctKind = p.id === fullPaymentId ? "FULL" : "PARTIAL";
      if (p.kind === correctKind) {
        unchanged++;
        continue;
      }
      await prisma.payment.update({ where: { id: p.id }, data: { kind: correctKind } });
      if (correctKind === "FULL") fixedFull++;
      else fixedPartial++;
    }
  }

  console.log(`✓ PARTIAL deb tuzatildi: ${fixedPartial} ta`);
  console.log(`✓ FULL deb tuzatildi: ${fixedFull} ta`);
  console.log(`— O'zgarishsiz qoldi: ${unchanged} ta`);
  console.log("\n✅ Backfill yakunlandi.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Xato:", e); process.exit(1); });
