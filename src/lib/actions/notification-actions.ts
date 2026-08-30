"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Bitta bildirishnomani o'qilgan deb belgilash. */
export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/notifications");
}

/** Barcha bildirishnomalarni o'qilgan deb belgilash. */
export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/notifications");
}
