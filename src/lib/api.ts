import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * API Route Handler'lar uchun standart javob va xato yordamchilari.
 * Production'da stack trace yoki maxfiy ma'lumot chiqmasligini ta'minlaydi.
 */

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...extra } },
    { status },
  );
}

/** Kutilmagan xatolarni korrelyatsiya ID bilan loglaydi, foydalanuvchiga umumiy xabar qaytaradi. */
export function apiServerError(error: unknown, context: string) {
  const correlationId = randomUUID();
  console.error(`[${context}] correlationId=${correlationId}`, error);
  return apiError(
    "internal_error",
    "Ichki xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.",
    500,
    { correlationId },
  );
}

/** Constant-time string solishtirish (API kalitni tekshirish uchun). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
