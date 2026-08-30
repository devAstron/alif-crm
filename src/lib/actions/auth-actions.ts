"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { destroySession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { AUDIT } from "@/lib/constants";

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    const ip = await getClientIp();
    await writeAudit({
      userId: user.id,
      action: AUDIT.LOGOUT,
      entity: "User",
      entityId: user.id,
      ip,
    });
  }
  await destroySession();
  redirect("/login");
}
