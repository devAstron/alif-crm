import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader title="Sozlamalar" />
      <SettingsNav />
      {children}
    </>
  );
}
