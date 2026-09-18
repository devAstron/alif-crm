/**
 * DIAGNOSTIKA v2: sanoqlar mos, lekin summalar mos emas — nega?
 * Har bir bugungi to'lovni: lead.deletedAt, joriy bosqich, va "Bugun" Kanban
 * filtriga (stageActivityWhere) mos keladimi — barchasini ko'rsatadi.
 *
 * Ishga tushirish (Railway Console'da):  npx tsx scripts/diag-payments2.ts
 */
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";
import { stageActivityWhere } from "@/lib/leads/scope";

const TZ = "Asia/Tashkent";

function dayRange(daysAgo: number) {
  const now = new Date();
  const key = formatInTimeZone(new Date(now.getTime() - daysAgo * 86400000), TZ, "yyyy-MM-dd");
  const start = new Date(`${key}T00:00:00.000+05:00`);
  const end = new Date(`${key}T23:59:59.999+05:00`);
  return { key, start, end };
}

async function main() {
  const { key, start, end } = dayRange(0);
  console.log(`BUGUN (${key})\n${"=".repeat(70)}`);

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: start, lte: end } },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      amount: true,
      kind: true,
      paidAt: true,
      lead: {
        select: {
          id: true, name: true, deletedAt: true,
          createdAt: true, assignedAt: true, stageChangedAt: true,
          stage: { select: { slug: true, name: true } },
        },
      },
    },
  });

  console.log(`Jami to'lov: ${payments.length}\n`);

  let sumFull = 0, sumPartial = 0, sumFullDeleted = 0, sumPartialDeleted = 0;
  const activityWhere = stageActivityWhere(start, end);

  for (const p of payments) {
    const amt = Number(p.amount);
    const isDeleted = !!p.lead.deletedAt;
    if (p.kind === "FULL") { sumFull += amt; if (isDeleted) sumFullDeleted += amt; }
    else { sumPartial += amt; if (isDeleted) sumPartialDeleted += amt; }

    // Shu lead haqiqatan "Bugun" board so'roviga tushadimi (leadScopeWhere + stageActivityWhere)?
    const matchesBoard = await prisma.lead.findFirst({
      where: { id: p.lead.id, deletedAt: null, ...activityWhere },
      select: { id: true },
    });

    console.log(
      `  [${p.kind.padEnd(7)}] ${amt.toLocaleString("ru-RU").padStart(10)} so'm | ${p.lead.name.padEnd(20)} | ` +
        `bosqich: ${p.lead.stage.name.padEnd(20)} | O'CHIRILGAN: ${isDeleted ? "HA ⚠️" : "yo'q"} | ` +
        `Bugun boardga tushadimi: ${matchesBoard ? "HA" : "YO'Q ⚠️"} | vaqt: ${formatInTimeZone(p.paidAt, TZ, "dd.MM HH:mm")}`,
    );
  }

  console.log(`\n--- Yig'indi ---`);
  console.log(`FULL jami:    ${sumFull.toLocaleString("ru-RU")} so'm (shundan o'chirilgan leadlardan: ${sumFullDeleted.toLocaleString("ru-RU")})`);
  console.log(`PARTIAL jami: ${sumPartial.toLocaleString("ru-RU")} so'm (shundan o'chirilgan leadlardan: ${sumPartialDeleted.toLocaleString("ru-RU")})`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error("XATO:", e); process.exit(1); });
