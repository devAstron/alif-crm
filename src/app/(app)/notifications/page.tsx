import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { PageHeader } from "@/components/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata = { title: "Bildirishnomalar — Alif CRM" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);

  return (
    <>
      <PageHeader title="Bildirishnomalar" />
      <NotificationList
        items={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          leadId: n.leadId,
          isRead: n.isRead,
          createdAt: n.createdAt,
        }))}
      />
    </>
  );
}
