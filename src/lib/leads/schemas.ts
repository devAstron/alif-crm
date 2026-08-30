import { z } from "zod";

/**
 * Kiruvchi lead API payload sxemasi (snake_case — tashqi integratorlar formati).
 * Faqat name va phone majburiy; qolganlari ixtiyoriy.
 */
export const incomingLeadSchema = z.object({
  name: z.string().trim().min(1, "Ism kerak").max(200),
  phone: z.string().trim().min(3, "Telefon kerak").max(50),

  language_level: z.string().trim().max(200).optional(),
  activity: z.string().trim().max(200).optional(),
  second_phone: z.string().trim().max(50).optional(),

  // Marketing / attribution
  ad_id: z.string().trim().max(100).optional(),
  adset_id: z.string().trim().max(100).optional(),
  campaign_id: z.string().trim().max(100).optional(),
  form_id: z.string().trim().max(100).optional(),
  lead_id: z.string().trim().max(100).optional(),
  campaign_name: z.string().trim().max(300).optional(),
  adset_name: z.string().trim().max(300).optional(),
  ad_name: z.string().trim().max(300).optional(),

  utm_source: z.string().trim().max(300).optional(),
  utm_medium: z.string().trim().max(300).optional(),
  utm_campaign: z.string().trim().max(300).optional(),
  utm_content: z.string().trim().max(300).optional(),
  utm_term: z.string().trim().max(300).optional(),

  fbc: z.string().trim().max(500).optional(),
  fbp: z.string().trim().max(500).optional(),
  landing_page: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(200).optional(),

  // Forma qo'shimcha savollari
  field1: z.string().trim().max(1000).optional(),
  field2: z.string().trim().max(1000).optional(),
  field3: z.string().trim().max(1000).optional(),

  // Ixtiyoriy CRM fieldlari
  city: z.string().trim().max(200).optional(),
  profession: z.string().trim().max(200).optional(),
  goal: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(2000).optional(),

  cookies: z.unknown().optional(),

  // Custom fieldlar: { slug: value }
  custom: z.record(z.string(), z.unknown()).optional(),

  // Idempotency (yoki header orqali)
  idempotency_key: z.string().trim().max(200).optional(),
});

export type IncomingLeadInput = z.infer<typeof incomingLeadSchema>;
