/**
 * DIAGNOSTIKA (vaqtinchalik): "Bugun"/"Kecha" uchun to'lovlarni chuqur tekshirish.
 * Dashboard.ts aynan qanday hisoblayotganini QAYTA TAKRORLAB, har bir Payment
 * yozuvini (kim, qancha, qachon, qaysi turi, leadning HOZIRGI bosqichi) chiqaradi —
 * shunda Kanban'da ko'rinmayotgan, lekin Dashboard summasiga kirayotgan
 * to'lovlarni aniq topamiz.
 *
 * Ishga tushirish (Railway Console'da):  npx tsx scripts/diag-payments.ts
 */
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";

const TZ = "Asia/Tashkent";

function dayRange(daysAgo: number) {
  const now = new Date();
  const key = formatInTimeZone(new Date(now.getTime() - daysAgo * 86400000), TZ, "yyyy-MM-dd");
  const start = new Date(`${key}T00:00:00.000+05:00`);
  const end = new Date(`${key}T23:59:59.999+05:00`);
  return { key, start, end };
}

async function inspect(label: string, daysAgo: number) {
  const { key, start, end } = dayRange(daysAgo);
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${label} (${key}, Asia/Tashkent) — oraliq: ${start.toISOString()} .. ${end.toISOString()}`);
  console.log("=".repeat(70));

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: start, lte: end } },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      amount: true,
      kind: true,
      paidAt: true,
      createdAt: true,
      note: true,
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          assignedAt: true,
          stageChangedAt: true,
          stage: { select: { slug: true, name: true } },
        },
      },
    },
  });

  console.log(`\nJami shu kunga (paidAt) tegishli to'lovlar soni: ${payments.length}\n`);

  let sumFull = 0;
  let sumPartial = 0;
  for (const p of payments) {
    const amt = Number(p.amount);
    if (p.kind === "FULL") sumFull += amt;
    else sumPartial += amt;
    console.log(
      `  [${p.kind.padEnd(7)}] ${amt.toLocaleString("ru-RU").padStart(10)} so'm | ` +
        `${p.lead.name.padEnd(20)} | joriy bosqich: ${p.lead.stage.name.padEnd(20)} | ` +
        `to'lov vaqti: ${formatInTimeZone(p.paidAt, TZ, "dd.MM HH:mm")} | ` +
        `lead tushdi: ${formatInTimeZone(p.lead.createdAt, TZ, "dd.MM")} | paymentId: ${p.id}`,
    );
  }

  console.log(`\n  --- Dashboard.ts formulasi bo'yicha (Payment.kind asosida) ---`);
  console.log(`  To'liq to'lov summasi (kind=FULL):    ${sumFull.toLocaleString("ru-RU")} so'm`);
  console.log(`  Qisman to'lov summasi (kind=PARTIAL): ${sumPartial.toLocaleString("ru-RU")} so'm`);

  // Joriy bosqichi "Qisman to'lov qildi"/"To'lov qildi" BO'LMAGAN, lekin shu kun
  // to'lov qilingan leadlar — Kanban'ning shu ikki ustunida ko'rinmaydi!
  const invisibleInKanban = payments.filter(
    (p) => !["partial_payment", "paid"].includes(p.lead.stage.slug),
  );
  if (invisibleInKanban.length > 0) {
    console.log(`\n  ⚠️  KANBAN'DA KO'RINMAYDIGAN (joriy bosqichi boshqa) to'lovlar: ${invisibleInKanban.length} ta`);
    for (const p of invisibleInKanban) {
      console.log(
        `     - ${p.lead.name} | ${Number(p.amount).toLocaleString("ru-RU")} so'm [${p.kind}] | ` +
          `hozir: "${p.lead.stage.name}" bosqichida | to'lov vaqti: ${formatInTimeZone(p.paidAt, TZ, "dd.MM HH:mm")}`,
      );
    }
  } else {
    console.log(`\n  ✓ Barcha to'lovlar leadlari hali "Qisman to'lov qildi"/"To'lov qildi" bosqichida — Kanban bilan mos.`);
  }
}

async function main() {
  await inspect("BUGUN", 0);
  await inspect("KECHA", 1);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("XATO:", e);
  process.exit(1);
});
