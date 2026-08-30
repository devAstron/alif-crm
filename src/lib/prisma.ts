import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client singleton.
 * Dev hot-reload paytida bir nechta ulanish yaratilmasligi uchun global'da saqlaymiz.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
