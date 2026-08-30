import { prisma } from "@/lib/prisma";
import { ProcessingManager } from "@/components/settings/processing-manager";

export const metadata = { title: "Qayta ishlash holatlari — Alif CRM" };

export default async function ProcessingSettingsPage() {
  const reasons = await prisma.processingReason.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        &quot;Qayta ishlashda&quot; bosqichida operatorlar shu holatlardan birini tanlaydi.
      </p>
      <ProcessingManager reasons={reasons.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive }))} />
    </div>
  );
}
