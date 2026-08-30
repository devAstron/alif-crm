import { prisma } from "@/lib/prisma";

export interface FbSettingsView {
  adAccountId: string;
  apiVersion: string;
  enabled: boolean;
  hasAccessToken: boolean; // token o'rnatilganmi (qiymatning o'zi hech qachon chiqmaydi)
  lastSyncAt: Date | null;
  lastSyncError: string | null;
}

/** Facebook sozlamalarini UI uchun (Access Token HECH QACHON qaytarilmaydi). */
export async function getFbSettingsView(): Promise<FbSettingsView> {
  const s = await prisma.fbSettings.findUnique({ where: { id: "singleton" } });
  return {
    adAccountId: s?.adAccountId ?? "",
    apiVersion: s?.apiVersion ?? "v21.0",
    enabled: s?.enabled ?? false,
    hasAccessToken: !!s?.accessTokenEnc,
    lastSyncAt: s?.lastSyncAt ?? null,
    lastSyncError: s?.lastSyncError ?? null,
  };
}
