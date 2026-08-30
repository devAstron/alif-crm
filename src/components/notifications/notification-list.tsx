"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, UserPlus, CircleDollarSign, ListChecks, Info } from "lucide-react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/notification-actions";
import { formatTashkent } from "@/lib/datetime";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  leadId: string | null;
  isRead: boolean;
  createdAt: Date;
}

const ICONS: Record<string, typeof Bell> = {
  TASK_NEW: ListChecks,
  TASK_DUE: ListChecks,
  LEAD_ASSIGNED: UserPlus,
  LEAD_REASSIGNED: UserPlus,
  PAYMENT: CircleDollarSign,
  PARTIAL_PAYMENT: CircleDollarSign,
  SYSTEM: Info,
};

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasUnread = items.some((i) => !i.isRead);

  function open(item: NotificationItem) {
    startTransition(async () => {
      if (!item.isRead) await markNotificationReadAction(item.id);
      if (item.leadId) router.push(`/leads/${item.leadId}`);
      else router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <div>
      {hasUnread && (
        <div className="mb-4 flex justify-end">
          <button onClick={markAll} disabled={pending} className="btn-ghost text-sm">
            <CheckCheck className="h-4 w-4" />
            Barchasini o&apos;qilgan deb belgilash
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Bildirishnomalar yo&apos;q
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = ICONS[item.type] ?? Bell;
            return (
              <li key={item.id}>
                <button
                  onClick={() => open(item)}
                  disabled={pending}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                    item.isRead
                      ? "border-slate-100 bg-white"
                      : "border-brand-100 bg-brand-50/60"
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.isRead ? "bg-slate-100 text-slate-500" : "bg-brand-100 text-brand-700"}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    {item.body && <p className="mt-0.5 text-sm text-slate-600">{item.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">{formatTashkent(item.createdAt)}</p>
                  </div>
                  {!item.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
