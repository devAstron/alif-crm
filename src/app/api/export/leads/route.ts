import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLeadWhere } from "@/lib/leads/filters";
import { formatTashkent } from "@/lib/datetime";
import { sourceLabel } from "@/lib/format";

export const runtime = "nodejs";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Leadlarni CSV sifatida eksport qiladi (Admin/Targetolog). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "TARGETOLOG") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const where = buildLeadWhere(user, params);

  const [leads, payments] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        stage: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.payment.groupBy({ by: ["leadId"], where: { lead: where }, _sum: { amount: true } }),
  ]);

  const paidByLead = new Map(payments.map((p) => [p.leadId, Number(p._sum.amount ?? 0n)]));

  const headers = [
    "Sarlavha", "Ism", "Telefon", "Bosqich", "Operator", "Manba",
    "Campaign", "Ad set", "Ad", "UTM Source", "Jami to'lov", "Kelgan sana",
  ];

  const rows = leads.map((l) =>
    [
      l.title, l.name, l.phone, l.stage.name, l.assignedTo?.name ?? "", sourceLabel(l.source),
      l.campaignName ?? l.campaignId ?? "", l.adsetName ?? l.adsetId ?? "", l.adName ?? l.adId ?? "",
      l.utmSource ?? "", paidByLead.get(l.id) ?? 0, formatTashkent(l.createdAt),
    ].map(csvCell).join(","),
  );

  const csv = "﻿" + [headers.map(csvCell).join(","), ...rows].join("\r\n");
  const filename = `leadlar-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
