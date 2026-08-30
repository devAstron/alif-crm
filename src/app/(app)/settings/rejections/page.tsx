import { prisma } from "@/lib/prisma";
import { RejectionManager } from "@/components/settings/rejection-manager";

export const metadata = { title: "Rad etish sabablari — Alif CRM" };

export default async function RejectionsSettingsPage() {
  const reasons = await prisma.rejectionReason.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        &quot;Rad etildi&quot; bosqichida operatorlar shu sabablardan birini tanlaydi.
      </p>
      <RejectionManager reasons={reasons.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive }))} />
    </div>
  );
}
