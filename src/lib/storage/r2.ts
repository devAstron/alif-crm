import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * Cloudflare R2 (S3-mos) — to'lov cheki/hujjat fayllari uchun.
 * Bucket SHAXSIY (private): fayllar hech qachon ochiq internetga chiqmaydi,
 * ko'rish faqat qisqa muddatli (5 daqiqa) signed URL orqali, /api/receipts
 * marshruti orqali (u avval foydalanuvchining shu leadга kirish huquqini
 * tekshiradi).
 */

const RECEIPTS_PREFIX = "receipts/";

export function isR2Configured(): boolean {
  return !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/** Ruxsat etilgan fayl turlari (rasm yoki hujjat). */
export const ALLOWED_RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};
export const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10 MB

/** Faylni R2'ga yuklaydi, saqlash kalitini (key) qaytaradi. */
export async function uploadReceipt(
  paymentId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const ext = ALLOWED_RECEIPT_TYPES[contentType] ?? "bin";
  const key = `${RECEIPTS_PREFIX}${paymentId}-${Date.now()}.${ext}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
  return key;
}

/** Saqlangan kalit uchun qisqa muddatli (5 daqiqa) ko'rish havolasi. */
export async function getReceiptViewUrl(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: 300 });
}

/** Faylni R2'dan o'chiradi (chek almashtirilganda yoki o'chirilganda). */
export async function deleteReceipt(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
}
