import { z } from "zod";

/**
 * Server-side muhit o'zgaruvchilarini validatsiya qilish.
 * Faqat serverda ishlatiladi — hech qachon clientga import qilinmasin.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL kerak"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET kamida 16 belgidan iborat bo'lsin"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CRM_API_KEY: z.string().min(1, "CRM_API_KEY kerak"),
  META_PIXEL_ID: z.string().optional().default(""),
  META_ACCESS_TOKEN: z.string().optional().default(""),
  META_TEST_EVENT_CODE: z.string().optional().default(""),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
  // Cloudflare R2 — to'lov cheki fayllari (ixtiyoriy; bo'lmasa yuklash tugmasi yashiriladi)
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET_NAME: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Muhit o'zgaruvchilari noto'g'ri sozlangan:\n${issues}`);
}

export const env = parsed.data;
