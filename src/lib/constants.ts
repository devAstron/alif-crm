/**
 * Loyiha bo'ylab ishlatiladigan barqaror konstantalar.
 * Bosqich sluglari, cookie nomi, audit action'lar shu yerda.
 */

// --- Sessiya ---
export const SESSION_COOKIE = "alif_session";
export const SESSION_TTL_DAYS = 30;

// --- Pipeline bosqich sluglari (barqaror, machine-readable) ---
export const STAGE = {
  UNPROCESSED: "unprocessed", // Ko'rib chiqilmagan (Nerazroblenniy)
  NEW_LEAD: "new_lead", // Yangi lead
  FIRST_CALL: "first_call", // Birinchi qo'ng'iroq
  NO_ANSWER: "no_answer", // Ko'tarmadi
  CALLBACK: "callback", // Qayta aloqa
  QUALIFIED: "qualified", // Sifatli lid
  IN_PROGRESS: "in_progress", // Qayta ishlashda
  REJECTED: "rejected", // Rad etildi
  PAYMENT_PENDING: "payment_pending", // To'lov kutilmoqda
  PARTIAL_PAYMENT: "partial_payment", // Qisman to'lov qildi
  PAID: "paid", // To'lov qildi
  TRIAL_LESSON: "trial_lesson", // Sinov darsi
} as const;

export type StageSlug = (typeof STAGE)[keyof typeof STAGE];

// Default pipeline bosqichlari (seed va business logic uchun manba)
export const DEFAULT_STAGES: {
  slug: StageSlug;
  name: string;
  color: string;
  isSystem: boolean;
}[] = [
  { slug: STAGE.UNPROCESSED, name: "Ko'rib chiqilmagan", color: "#94a3b8", isSystem: true },
  { slug: STAGE.NEW_LEAD, name: "Yangi lead", color: "#3b82f6", isSystem: true },
  { slug: STAGE.FIRST_CALL, name: "Birinchi qo'ng'iroq", color: "#6366f1", isSystem: false },
  { slug: STAGE.NO_ANSWER, name: "Ko'tarmadi", color: "#f59e0b", isSystem: false },
  { slug: STAGE.CALLBACK, name: "Qayta aloqa", color: "#eab308", isSystem: false },
  // "Sifatli lid" endi bosqich emas — alohida belgi (tugma+checklist). STAGE.QUALIFIED sluggi saqlanadi.
  { slug: STAGE.IN_PROGRESS, name: "Qayta ishlashda", color: "#8b5cf6", isSystem: false },
  { slug: STAGE.REJECTED, name: "Rad etildi", color: "#ef4444", isSystem: true },
  { slug: STAGE.PAYMENT_PENDING, name: "To'lov kutilmoqda", color: "#f97316", isSystem: false },
  { slug: STAGE.PARTIAL_PAYMENT, name: "Qisman to'lov qildi", color: "#84cc16", isSystem: true },
  { slug: STAGE.PAID, name: "To'lov qildi", color: "#22c55e", isSystem: true },
  { slug: STAGE.TRIAL_LESSON, name: "Sinov darsi", color: "#06b6d4", isSystem: false },
];

// Qisman to'lov uchun minimal summa (so'm)
export const MIN_PARTIAL_PAYMENT = 100_000n;

// --- Audit action'lar ---
export const AUDIT = {
  LOGIN: "auth.login",
  LOGOUT: "auth.logout",
  LEAD_CREATE: "lead.create",
  LEAD_UPDATE: "lead.update",
  LEAD_FIELD_UPDATE: "lead.field_update",
  LEAD_STAGE_CHANGE: "lead.stage_change",
  LEAD_ASSIGN: "lead.assign",
  LEAD_REASSIGN: "lead.reassign",
  LEAD_DELETE: "lead.delete",
  LEAD_RESTORE: "lead.restore",
  PAYMENT_CREATE: "payment.create",
  PAYMENT_UPDATE: "payment.update",
  REFUND_CREATE: "refund.create",
  TASK_CREATE: "task.create",
  TASK_UPDATE: "task.update",
  COMMENT_CREATE: "comment.create",
  SETTINGS_UPDATE: "settings.update",
  CAPI_CONFIG_UPDATE: "capi.config_update",
  FB_CONFIG_UPDATE: "fb.config_update",
  FB_SYNC: "fb.sync",
  CUSTOM_FIELD_UPDATE: "custom_field.update",
  PIPELINE_UPDATE: "pipeline.update",
  USER_UPDATE: "user.update",
  TELEGRAM_LINK: "telegram.link",
} as const;

// Standart lead fieldlari (majburiy field sozlamalarida ishlatiladi)
export const STANDARD_LEAD_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Ism" },
  { key: "phone", label: "Telefon" },
  { key: "arabicLevel", label: "Arab tilini bilish darajasi" },
  { key: "activity", label: "Faoliyati" },
  { key: "tariff", label: "Tarif" },
  { key: "age", label: "Yosh" },
  { key: "gender", label: "Jins" },
  { key: "city", label: "Shahar" },
  { key: "profession", label: "Kasb" },
  { key: "interestLevel", label: "Kursga qiziqish darajasi" },
  { key: "goal", label: "Maqsadi" },
  { key: "dealAmount", label: "Kelishilgan summa" },
  { key: "inquirySource", label: "Zayafka manbasi" },
  { key: "callbackAt", label: "Qayta aloqa vaqti" },
  { key: "rejectionReasonId", label: "Rad etish sababi" },
];
