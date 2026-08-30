import "server-only";
import { headers } from "next/headers";

/** So'rov headerlaridan client IP manzilini olishga urinadi (Railway proxy orqali). */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? null;
}

/** Route Handler ichidagi Request ob'ektidan IP olish. */
export function getIpFromRequest(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}
