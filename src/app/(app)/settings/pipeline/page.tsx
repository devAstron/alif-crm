import { prisma } from "@/lib/prisma";
import { getDefaultPipeline } from "@/lib/pipeline";
import { STANDARD_LEAD_FIELDS } from "@/lib/constants";
import { PipelineEditor } from "@/components/settings/pipeline-editor";

export const metadata = { title: "Voronka sozlamalari — Alif CRM" };

export default async function PipelineSettingsPage() {
  const pipeline = await getDefaultPipeline();
  const customFields = await prisma.customField.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true },
  });

  const availableFields = [
    ...STANDARD_LEAD_FIELDS,
    ...customFields.map((c) => ({ key: `custom:${c.slug}`, label: c.name })),
  ];

  const stages = pipeline.stages.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    color: s.color,
    isSystem: s.isSystem,
    requiredFields: (s.requiredFields as string[]) ?? [],
  }));

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Bosqichlarni tartiblang, rang bering va har biriga o&apos;tish uchun majburiy maydonlarni belgilang.
      </p>
      <PipelineEditor stages={stages} availableFields={availableFields} />
    </div>
  );
}
