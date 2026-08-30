# Arxitektura va qarorlar jurnali (DECISIONS.md)

Bu fayl noaniq talablar bo'yicha tanlangan xavfsiz standartlarni va muhim texnik qarorlarni qayd etadi (Master prompt, qoida 17).

## Texnologik stack

| Soha | Tanlov | Sabab |
|------|--------|-------|
| Framework | **Next.js 16** (App Router) + TypeScript strict | Spec tavsiyasi; SSR, server actions, monolit |
| ORM / DB | **Prisma 6.19.3** + PostgreSQL (Neon, bulutli) | Spec tavsiyasi. `prisma@latest` hozir 8.0.0-rc (beta) bo'lgani uchun barqaror 6.x tanlandi |
| Auth | **Custom session** (DB'da `Session` jadvali, httpOnly cookie, opaque token) | Yengil, revocation qulay, NextAuth kabi og'ir bog'liqliksiz |
| Parol | **bcryptjs** (12 rounds) | Ishonchli, native build talab qilmaydi |
| Validatsiya | **zod** (server-side) | Type-safe |
| UI | **Tailwind CSS v4** + custom komponent klasslari + **lucide-react** | Yengil, og'ir UI kutubxonasiz |
| Sana/vaqt | **date-fns** + **date-fns-tz**, `Asia/Tashkent` | Spec talabi |
| Test | **vitest** | Yengil, tez |

## Muhim qarorlar

1. **Pul qiymatlari** `BigInt` (butun so'm) sifatida saqlanadi. Client'ga uzatishda `serializeBigInt` orqali `number`ga o'giriladi (so'm fraksiyasiz).
2. **Vaqt** UTC'da saqlanadi, UI'da `Asia/Tashkent` bo'yicha ko'rsatiladi.
3. **"Nerazroblenniy"** UI'da **"Ko'rib chiqilmagan"** deb ko'rsatiladi; DB slug: `unprocessed`.
4. **Bosqich sluglari** barqaror (ingliz), UI nomlari o'zbekcha (`constants.ts` → `DEFAULT_STAGES`).
5. **Majburiy fieldlar** har bosqichda `PipelineStage.requiredFields` (JSON string[]) sifatida saqlanadi. Standart field kaliti (`phone`) yoki custom field (`custom:<slug>`).
6. **Meta Access Token** DB'da **AES-256-GCM bilan shifrlangan** holda saqlanadi (`crypto.ts`), hech qachon frontendga chiqmaydi, faqat maskalangan ko'rinishda ko'rsatiladi.
7. **Sessiya cookie** — raw token faqat cookie'da, DB'da SHA-256 hash saqlanadi.
8. **Route himoyasi** — `proxy.ts` (Next 16'da `middleware` o'rniga) faqat cookie mavjudligini tekshiradi; asl authorization har sahifa/action ichida `requireUser`/`requireRole` bilan server tomonda.
9. **Marshrut himoyasi ikki qatlamli**: proxy (yengil) + server-side rol tekshiruvi (haqiqiy).

## Ma'lum advisory (qabul qilingan)

- `deepmerge-ts` (Prisma 6 CLI ichidagi `@prisma/config` bog'liqligi) da DoS advisory bor. Bu **faqat build-vaqti CLI config yuklashda** ishlatiladi, production runtime'da tashqi input bilan ishlamaydi — shuning uchun xavf yo'q. Prisma keyingi relizlarda yangilaydi.

## Ish tartibi

Loyiha **bosqichma-bosqich** (Master prompt §40 PHASE 1–9) quriladi; har bosqich oxirida typecheck + lint + build + (keyinchalik) testlar bajariladi va foydalanuvchiga ko'rsatiladi.

### Holat
- ✅ **PHASE 1**: project init, DB schema, auth, roles — yakunlandi.
- ✅ **PHASE 2**: pipeline, kiruvchi lead API, Kanban (drag&drop), lead detail — yakunlandi.
- ✅ **PHASE 3**: izohlar, faoliyat tarixi (timeline), vazifalar bo'limi, qayta aloqada avtomatik vazifa, bildirishnomalar markazi — yakunlandi.
- ✅ **PHASE 4**: to'lovlar (qisman/to'liq qoidalari), admin dashboard (KPI, voronka, operator stat), Targetolog hisobotlari (CPL/CPA/ROAS) — yakunlandi.
- ✅ **PHASE 5**: Targetolog kabineti, Meta CAPI (QualifiedLead/Purchase), CAPI loglari, retry, deterministik event_id dedup — yakunlandi.
- ✅ **PHASE 6**: Telegram bot (webhook + secret), akkaunt bog'lash (/start kod), bildirishnoma yetkazish, profil sahifasi, admin reassign — yakunlandi.
- ✅ **PHASE 7**: sozlamalar (pipeline muharriri, custom fieldlar, rad sabablari, foydalanuvchilar), o'chirilgan leadlar+tiklash, audit jurnali, CSV export, lead filtrlari (§18) — yakunlandi.
- ✅ **PHASE 8**: 24 test (13 unit + 11 integratsion, vitest), xavfsizlik headerlari, X-Powered-By o'chirildi — yakunlandi.
- ✅ **PHASE 9**: to'liq README (o'zbekcha), `railway.json` (build + migrate deploy + start), API/CAPI/Telegram hujjatlari, yakuniy QA — yakunlandi.

## Performans / Baza regioni
- Neon bazasi **Singapur → Frankfurt (eu-central-1)** ga ko'chirildi (Toshkentdan kechikish ~200ms → ~102ms, 2x). **Direct** (pooler'siz) ulanish ishlatiladi (~10 foydalanuvchi uchun sodda va ishonchli; migratsiyalar ham direct ustidan ishlaydi).
- Hot-path so'rovlar optimallashtirildi: `changeLeadStage` bosqich so'rovlari birlashtirildi + commit'dan keyingi audit/notif/CAPI parallel; `getLeadDetail` parallel; Telegram token yo'q bo'lsa notification'da baza so'rovi o'tkazib yuboriladi.
- Production'da app va DB bir regionда (Railway EU + Neon Frankfurt) bo'lsa app↔DB ~5–15ms bo'ladi.

## Keyingi yaxshilanishlar (post-MVP)
- **Operator dashboard**: `/dashboard` rolga qarab — OPERATOR o'z statistikasini ko'radi (KPI, donut chart bosqichlar bo'yicha, kunlik bar chart, voronka, sana filtrlari). Grafiklar yengil (SVG/CSS, kutubxonasiz).
- **Telegram gate**: operator botni faollashtirmaguncha `/leads`ga kira olmaydi (`requireLeadAccess` → `/dashboard`ga yo'naltiradi), dashboardда faollashtirish banneri chiqadi. Operator default sahifasi `/dashboard`.
- **Telegram lokal polling**: public URL yo'qligi uchun lokalда `npm run telegram:poll` (`scripts/telegram-poll.ts`) getUpdates orqali `/start <kod>`ни qayta ishlaydi. `/start` mantig'i `src/lib/telegram/handle.ts`da (webhook ham, polling ham ishlatadi). Production'da webhook ishlatiladi.
- **Bot**: @alif_CRMbot (token `.env`da).

## Holat: BARCHA 9 BOSQICH TUGADI ✅
typecheck ✅ · lint ✅ · build ✅ (21 marshrut) · 24 test ✅. Lokalda to'liq ishlaydi. Railway'ga deploy uchun tayyor.

## PHASE 8 qarorlari
- **Testlar**: `vitest` (`vitest.config.mts` + `.env` yuklovchi setup). Unit (crypto, slug, money, datetime, CAPI payload) + integratsion (lead API, transitionlar, to'lovlar, CAPI dedup, soft-delete) — test ma'lumotlari `+99890TEST` prefiksi bilan, `afterAll`da tozalanadi.
- **Xavfsizlik headerlari**: `next.config.ts` — X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy; `poweredByHeader: false`.

## PHASE 7 qarorlari
- **Sozlamalar** `/settings/*` subnav bilan (faqat ADMIN). Slug'lar `slugify` + `uniqueSlug` orqali.
- **Soft-delete (§21, §23)**: custom fieldlar va rad sabablari faollik bilan (nofaol = yashirin, ma'lumot saqlanadi); leadlar `deletedAt` bilan, admin tiklaydi.
- **Export (§20)**: `/api/export/leads` CSV (UTF-8 BOM), faqat ADMIN/TARGETOLOG, filtrlarni qo'llaydi.
- **Filtrlar (§18)**: `buildLeadWhere` — qidiruv (ism/telefon), operator, manba, sana, to'lov holati; Kanban va export'da umumiy. `leadScopeWhere` → `scope.ts` (aylanma import oldini olish).

## PHASE 6 qarorlari
- **Telegram bog'lash**: operator profilда kod oladi (15 daq), botga `/start <kod>` yuboradi; webhook `X-Telegram-Bot-Api-Secret-Token` (TELEGRAM_WEBHOOK_SECRET) bilan tekshiriladi, kod bo'yicha userni topib `TelegramAccount` yaratadi.
- **Yetkazish**: `createNotification` bog'langan bo'lsa Telegramga ham yuboradi (best-effort, token yo'q bo'lsa no-op, hech qachon throw qilmaydi).
- **Reassign** (§37): admin lead detalidan operatorni almashtiradi → audit `lead.reassign` + yangi operatorga bildirishnoma.

## PHASE 5 qarorlari
- **CAPI xavfsizligi**: Access Token DB'da AES-GCM shifrlangan, `getCapiSettingsView` uni HECH QACHON qaytarmaydi (faqat `hasAccessToken` bool). Token URL query'da yuboriladi, loglanmaydi. `payloadSafe`da telefon SHA-256 hash (raw yo'q).
- **Dedup**: deterministik `event_id = "{KIND}:{leadId}"` (Meta ham dedup qiladi) + `lead.qualifiedLeadSentAt/purchaseSentAt` + CapiEvent unique eventId.
- **Xatoga chidamlilik (§16)**: `fireCapiForStage` hech qachon throw qilmaydi; transition commit'dan keyin ishlaydi. Transient (5xx/429/network) xatoda 1 marta avtomatik retry + qo'lda retry tugmasi.
- **action_source** = `system_generated` (CRM offline konversiya). Purchase `value` = jami to'lovlar, `currency` = UZS.

## PHASE 4 qarorlari
- **Sotuv/tushum metrikasi**: sotuvlar soni = `paidAt` sana oralig'ida bo'lgan leadlar; tushum (revenue) = shu oraliqda `Payment.paidAt` bo'lgan to'lovlar yig'indisi. Lead KPI = oraliqda yaratilgan leadlar, joriy bosqich bo'yicha.
- **To'lov bosqichlari** (§8): "Qisman to'lov qildi" — yangi to'lov ≥ 100 000 majburiy; "To'lov qildi" — jami (oldingi + yangi) > 0, `paidAt` o'rnatiladi. To'lov transition modalida so'raladi + mustaqil "To'lov qo'shish" ham bor.
- **MarketingReport.date** UTC yarim tunda (`YYYY-MM-DDT00:00:00Z`) saqlanadi, kun kaliti UTC bo'yicha o'qiladi. Kunlik guruhlash JS'da Toshkent bo'yicha.
- **Purchase/QualifiedLead CAPI** hozircha yuborilmaydi — 5-bosqichda `changeLeadStage`ga ulanadi (`qualifiedLeadSentAt`/`purchaseSentAt` dedup maydonlari tayyor).

## Reklama integratsiyasi (Facebook Marketing API + valyuta)
- **Sarf USD'da, sotuv so'mda**: reklama sarfi Facebook'dan USD'da olinadi (`AdInsight.spendUsd` — butun **sent**da, ya'ni USD×100). Har kunning sarfi o'sha kundagi **USD→UZS kursi** (`AdInsight.usdToUzs` snapshot) bilan so'mga o'giriladi. Shu bilan tarixiy kurs o'zgarsa ham hisobot barqaror qoladi.
- **Kurs manbasi**: Markaziy bank (CBU) ochiq API (`cbu.uz/.../json/USD/`), auth talab qilmaydi. `FxRate` jadvalida kun bo'yicha keshlanadi; CBU javob bermasa oxirgi ma'lum kurs, u ham bo'lmasa zaxira `12600` ishlatiladi (kesh qilinmaydi).
- **CPL/CPA/ROAS**: CPL = sarf(so'm)/CRM lead, CPA = sarf(so'm)/sotuv, ROAS = tushum(so'm)/sarf(so'm). CRM lead soni asos qilinadi (FB lead alohida ustunda solishtirish uchun ko'rsatiladi).
- **FB lead sanash (muhim)**: Meta bitta leadni bir necha `action_type` ostida qaytaradi (`lead`, `onsite_conversion.lead_grouped`, `offsite_complete_registration_add_meta_leads`, `offsite_search_add_meta_leads`, `offsite_content_view_add_meta_leads` — hammasi BIR XIL son). Bularni **qo'shmaslik** kerak (aks holda 2-5 barobar oshib ketadi) — ustuvorlik bo'yicha bittasini (`lead`) olamiz (`extractLeadCount`, `LEAD_ACTION_PRIORITY`).
- **Ulanishni tekshirish** `enabled`ni talab qilmaydi (`getFbConfig({ requireEnabled: false })`) — avval tekshirib, keyin yoqish mumkin. Kunlik sinxron esa `enabled=true` talab qiladi.
- **FB kredensiallari** `FbSettings` (singleton)da: `adAccountId`, `accessTokenEnc` (AES-256-GCM, CAPI token kabi), `apiVersion`. Token hech qachon frontendga chiqmaydi. Targetolog/Admin sozlaydi, "Ulanishni tekshirish" tugmasi bitta so'rov bilan tekshiradi.
- **Cron (production)**: ikki endpoint `CRON_SECRET` bilan himoyalangan (`Authorization: Bearer` yoki `?secret=`):
  - `GET /api/cron/reminders` — har ~10-15 daqiqada; qayta aloqa vaqtiga 30 daq qolgan vazifalarga Telegram eslatma.
  - `GET /api/cron/ad-sync` — har kuni **05:00 Asia/Tashkent**; kechagi kun uchun FB insights → `AdInsight`, kurs snapshot, FB vs CRM lead solishtiruvi. `?date=YYYY-MM-DD` bilan aniq kunni qayta sinxronlash mumkin.
  - Railway'da alohida **Cron service** (yoki tashqi scheduler) endpointga `curl` qiladi; `railway.json` sxemasi cron maydonini qo'llamaydi. Lokal test: secret o'rnatilmagan bo'lsa himoya o'chadi (`authorized()` true).

## PHASE 3 qarorlari
- **Tranzaksiya latency**: Neon uzoq masofada (~ap-southeast-1) — `changeLeadStage` va `createIncomingLead` tranzaksiyasi 5s timeout'ga urildi. Yechim: tranzaksiya faqat asosiy atomik yozuvlarni bajaradi (lead update/create + task + custom values), **audit va bildirishnoma commit'dan keyin** (ikkilamchi, transitionni bloklamaydi), timeout 15s.
- **Faoliyat tarixi (timeline)** bir nechta manbadan yig'iladi: AuditLog (bosqich/biriktirish/create), Comment, Task, Payment — vaqt bo'yicha saralanadi.
- **Bildirishnoma**: ichki CRM notification (`createNotification`); Telegram 6-bosqichda shu joyga ulanadi.

## PHASE 2 qo'shimcha qarorlari
- **@dnd-kit SSR muammosi**: `aria-describedby` id server/client'da farq qiladi → Kanban DnD faqat client mount bo'lgach ko'rsatiladi (`useSyncExternalStore`), SSR'da statik ustunlar.
- **Kanban scope**: OPERATOR faqat o'ziga biriktirilgan + "Ko'rib chiqilmagan" lentani ko'radi; ADMIN barchasini.
- **Biriktirish**: "Ko'rib chiqilmagan → boshqa bosqich" operator tomonidan qilinsa, lead o'sha operatorga biriktiriladi (§37).
- **Majburiy fieldlar**: bosqichga o'tishda tekshiriladi; yetishmasa modal (qayta aloqa vaqti / rad etish sababi) chiqadi, aks holda server bloklaydi.
- **Idempotency**: `Idempotency-Key` header > body `idempotency_key` > `lead_id`.
- **"To'lov summasi" (§5)** = `Lead.dealAmount` (kelishilgan narx); haqiqiy to'lovlar alohida `Payment` tranzaksiyalari (4-bosqich).
