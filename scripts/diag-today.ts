/**
 * VAQTINCHALIK diagnostika (faqat O'QIYDI): bugungi to'lovlar va ularning
 * Kanban kartasidagi/Dashboarddagi ko'rinishi. Natijani tekshirgach o'chiriladi.
 *   npx tsx scripts/diag-today.ts            (bugun)
 *   DAY=2026-10-18 npx tsx scripts/diag-today.ts
 */
import { prisma } from "@/lib/prisma";
import { stageActivityWhere } from "@/lib/leads/scope";
import { tashkentDayRange, tashkentDateKey } from "@/lib/datetime";

const som = (n: bigint | number) => Number(n).toLocaleString("en-US").replace(/,/g, " ");

async function main() {
  const base = process.env.DAY ? new Date(`${process.env.DAY}T12:00:00+05:00`) : new Date();
  const { start, end } = tashkentDayRange(base);
  console.log(`\n=== Kun: ${tashkentDateKey(base)} ===\n`);

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: start, lte: end } },
    orderBy: { paidAt: "asc" },
    include: {
      createdBy: { select: { name: true, role: true } },
      lead: { select: { id: true, name: true, createdAt: true, deletedAt: true, stage: { select: { slug: true } } } },
    },
  });

  console.log("--- BUGUNGI TO'LOVLAR (Dashboard shu to'lovlarni yig'adi) ---");
  let full = 0n, partial = 0n, deletedSum = 0n;
  const leadIds = new Set<string>();
  for (const p of payments) {
    const prior = await prisma.payment.aggregate({ where: { leadId: p.leadId, paidAt: { lt: start } }, _sum: { amount: true } });
    const del = p.lead.deletedAt ? " [LEAD O'CHIRILGAN]" : "";
    if (p.lead.deletedAt) deletedSum += p.amount;
    else if (p.kind === "FULL") full += p.amount;
    else partial += p.amount;
    leadIds.add(p.leadId);
    console.log(
      `${p.paidAt.toISOString().slice(11, 16)}Z ${p.kind.padEnd(7)} ${som(p.amount).padStart(10)} | ${p.lead.name.slice(0, 22).padEnd(22)} | lead hozir: ${p.lead.stage.slug.padEnd(16)} | oldingi kunlarda to'lagan: ${som(prior._sum.amount ?? 0n).padStart(9)} | kiritdi: ${p.createdBy.name} (${p.createdBy.role})${del}`,
    );
  }
  console.log(`\nJami to'lov yozuvlari: ${payments.length} ta, ${leadIds.size} ta lead`);
  console.log(`FULL: ${som(full)} | PARTIAL: ${som(partial)} | JAMI: ${som(full + partial)}  (o'chirilgan leadlar chiqarib tashlangan; ular: ${som(deletedSum)})`);

  console.log("\n--- KANBAN 'BUGUN' USTUNLARI (karta summasi = leadning BUTUN VAQT jami to'lovi) ---");
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, ...stageActivityWhere(start, end), stage: { slug: { in: ["partial_payment", "paid"] } } },
    select: { id: true, name: true, createdAt: true, stage: { select: { slug: true } } },
  });
  const byStage: Record<string, { n: number; cards: number; today: number }> = {};
  for (const l of leads) {
    const all = await prisma.payment.aggregate({ where: { leadId: l.id }, _sum: { amount: true } });
    const ref = await prisma.refund.aggregate({ where: { leadId: l.id }, _sum: { amount: true } });
    const today = await prisma.payment.aggregate({ where: { leadId: l.id, paidAt: { gte: start, lte: end } }, _sum: { amount: true } });
    const s = (byStage[l.stage.slug] ??= { n: 0, cards: 0, today: 0 });
    s.n += 1;
    s.cards += Number((all._sum.amount ?? 0n) - (ref._sum.amount ?? 0n));
    s.today += Number(today._sum.amount ?? 0n);
  }
  for (const [slug, s] of Object.entries(byStage)) {
    console.log(`${slug.padEnd(16)} ${s.n} ta lead | kartalardagi summalar yig'indisi: ${som(s.cards)} | shundan BUGUN tushgani: ${som(s.today)}`);
  }
  console.log("");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Xato:", e); process.exit(1); });
