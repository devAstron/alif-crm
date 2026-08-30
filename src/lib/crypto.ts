import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { env } from "./env";

/**
 * Xavfsizlik yordamchilari:
 *  - sessiya tokenlarini generatsiya/hashlash
 *  - maxfiy qiymatlarni (masalan Meta Access Token) AES-256-GCM bilan shifrlash
 */

// AUTH_SECRET dan 32-baytli kalit hosil qilamiz (AES-256 uchun)
const AES_KEY = scryptSync(env.AUTH_SECRET, "alif-crm-aes-salt", 32);

/** Kriptografik xavfsiz tasodifiy token (URL-safe hex). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Tokenni bazada saqlash uchun SHA-256 hash (raw token cookie'da qoladi). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Ixtiyoriy string uchun SHA-256 (masalan telefon hashlash — CAPI uchun ham ishlatiladi). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Maxfiy qiymatni shifrlash. Natija: base64(iv).base64(tag).base64(ciphertext) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

/** encryptSecret bilan shifrlangan qiymatni ochish. Xato bo'lsa null qaytaradi. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", AES_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/** Maxfiy qiymatni UI'da ko'rsatish uchun maskalash: "••••1234" */
export function maskSecret(value: string | null | undefined, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible) return "•".repeat(value.length);
  return "••••" + value.slice(-visible);
}
