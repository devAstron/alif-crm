import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

/**
 * Maxfiy kalitlar audit logga tushmasligi kerak.
 * Bu kalitlar oldData/newData ichidan olib tashlanadi.
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "accessToken",
  "accessTokenEnc",
  "token",
  "tokenHash",
  "apiKey",
  "secret",
]);

function sanitize(data: unknown): unknown {
  if (data == null) return data;
  if (Array.isArray(data)) return data.map(sanitize);
  if (typeof data === "bigint") return Number(data);
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = "***";
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return data;
}

export interface AuditParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldData?: unknown;
  newData?: unknown;
  ip?: string | null;
  tx?: Prisma.TransactionClient;
}

/** Audit log yozuvi yaratadi. Maxfiy maydonlar avtomatik maskalanadi. */
export async function writeAudit(params: AuditParams): Promise<void> {
  const client = params.tx ?? prisma;
  await client.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      oldData: params.oldData !== undefined ? (sanitize(params.oldData) as Prisma.InputJsonValue) : undefined,
      newData: params.newData !== undefined ? (sanitize(params.newData) as Prisma.InputJsonValue) : undefined,
      ip: params.ip ?? null,
    },
  });
}
