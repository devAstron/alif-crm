import { requireUser } from "@/lib/auth";
import { navFor } from "@/lib/navigation";
import { getUnreadCount } from "@/lib/notifications";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const nav = navFor(user.role);
  const unreadCount = await getUnreadCount(user.id);

  return (
    <AppShell user={{ name: user.name, role: user.role }} nav={nav} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
