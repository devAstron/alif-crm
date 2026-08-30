import { prisma } from "@/lib/prisma";
import { CustomFieldsManager } from "@/components/settings/custom-fields-manager";

export const metadata = { title: "Qo'shimcha maydonlar — Alif CRM" };

export default async function FieldsSettingsPage() {
  const fields = await prisma.customField.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Leadlar uchun qo&apos;shimcha maydonlar. O&apos;chirilganda ma&apos;lumot yo&apos;qolmaydi — maydon nofaol bo&apos;ladi.
      </p>
      <CustomFieldsManager
        fields={fields.map((f) => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          type: f.type,
          options: (f.options as string[]) ?? [],
          required: f.required,
          isActive: f.isActive,
        }))}
      />
    </div>
  );
}
