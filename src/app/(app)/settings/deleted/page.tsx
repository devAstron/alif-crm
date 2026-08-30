import { prisma } from "@/lib/prisma";
import { DeletedLeads } from "@/components/settings/deleted-leads";

export const metadata = { title: "O'chirilgan leadlar — Alif CRM" };

export default async function DeletedLeadsPage() {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: 200,
    include: { deletedBy: { select: { name: true } } },
  });

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">O&apos;chirilgan leadlarni tiklash mumkin.</p>
      <DeletedLeads
        leads={leads.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          deletedAt: l.deletedAt,
          deletedByName: l.deletedBy?.name ?? null,
        }))}
      />
    </div>
  );
}
