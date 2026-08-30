# Alif CRM — Online kurslar savdo CRM tizimi

Alif Academy Arab tili kursi uchun maxsus **Sales CRM**. Leadlarni tashqi integratorlardan (Make.com, Albato, Facebook Instant Forms) qabul qiladi, savdo voronkasi orqali boshqaradi, to'lovlarni hisoblaydi, Meta CAPI va Telegram bilan integratsiya qiladi. Interfeys **faqat o'zbek tilida**.

---

## 1. Loyiha nima qiladi

- Tashqi API orqali kelgan leadlarni qabul qiladi va "Ko'rib chiqilmagan" bosqichiga joylaydi.
- Operatorlar leadlarni Kanban (drag & drop) orqali boshqaradi, izoh/vazifa qo'shadi, to'lov kiritadi.
- Har bosqich uchun majburiy maydonlar, avtomatik biriktirish, qayta aloqa vazifasi.
- Admin dashboard (KPI, voronka, operator statistikasi), Targetolog kabineti (moliya, CPL/CPA/ROAS).
- Meta CAPI (QualifiedLead / Purchase) avtomatik yuborish + loglar + retry.
- Telegram bot orqali muhim bildirishnomalar.
- Audit jurnali, soft-delete/tiklash, CSV export, custom fieldlar, pipeline muharriri.

## 2. Arxitektura

Monolit **Next.js 16** ilovasi (App Router). Backend server actions + API route'lar orqali. Ma'lumotlar bazasi **PostgreSQL** (Prisma ORM). Biznes-logika `src/lib/` da (UI'dan ajratilgan), har bir amal serverda `requireUser`/`requireRole` bilan avtorizatsiya qilinadi.

```
src/
  app/
    (app)/            # Autentifikatsiyalangan sahifalar (sidebar layout)
      dashboard/ leads/ tasks/ reports/ targetolog/ settings/ profile/ notifications/
    api/
      integrations/leads/   # Kiruvchi lead API
      telegram/webhook/     # Telegram webhook
      export/leads/         # CSV export
    login/            # Kirish sahifasi
  lib/
    leads/            # Lead servisi, transitionlar, filtrlar, timeline
    analytics/        # Dashboard va hisobot hisob-kitoblari
    capi/             # Meta CAPI mijozi va servisi
    telegram/         # Telegram mijozi
    actions/          # Server action'lar
  components/         # UI komponentlari
prisma/               # schema.prisma, migratsiyalar, seed
tests/                # vitest testlari
```

Batafsil texnik qarorlar: [`DECISIONS.md`](./DECISIONS.md).

## 3. Talablar

- **Node.js** 20+ (24 bilan sinovdan o'tgan)
- **PostgreSQL** bazasi (Neon, Railway yoki lokal)
- npm

## 4. Lokal ishga tushirish

```bash
git clone <repo>
cd "Onlayn kurs CRM"
npm install
cp .env.example .env      # keyin .env ni to'ldiring (5-bo'lim)
npm run db:migrate        # bazaga jadvallarni yaratadi
npm run db:seed           # boshlang'ich ma'lumotlar (pipeline, foydalanuvchilar)
npm run dev               # http://localhost:3000
```

## 5. Muhit o'zgaruvchilari (`.env`)

| O'zgaruvchi | Tavsif |
|-------------|--------|
| `DATABASE_URL` | PostgreSQL ulanish satri (`postgresql://...`) |
| `AUTH_SECRET` | Sessiya cookie imzosi. `openssl rand -hex 32` |
| `APP_URL` | Ilova manzili (masalan `https://crm.example.com`) |
| `CRM_API_KEY` | Kiruvchi lead API kaliti. `openssl rand -hex 24` |
| `META_PIXEL_ID` | (ixtiyoriy) Meta Pixel ID — asosiysi CRM ichida sozlanadi |
| `META_ACCESS_TOKEN` | (ixtiyoriy) — asosiysi CRM ichida shifrlangan saqlanadi |
| `META_TEST_EVENT_CODE` | (ixtiyoriy) CAPI test kodi |
| `TELEGRAM_BOT_TOKEN` | Telegram bot tokeni (@BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook maxfiy kaliti. `openssl rand -hex 16` |

`.env` HECH QACHON commit qilinmaydi (`.gitignore`da).

## 6. Ma'lumotlar bazasi

```bash
npm run db:migrate    # dev migratsiya (prisma migrate dev)
npm run db:deploy     # production migratsiya (prisma migrate deploy)
npm run db:seed       # seed
npm run db:studio     # Prisma Studio (vizual ko'rish)
```

Pul qiymatlari `BigInt` (butun so'm), vaqtlar UTC'da saqlanadi va `Asia/Tashkent`da ko'rsatiladi.

## 7. Development

```bash
npm run dev
npm run typecheck && npm run lint && npm run build   # tekshiruv
npm test                                             # vitest
```

## 8. Seed loginlar (faqat development)

| Login | Parol | Rol |
|-------|-------|-----|
| `admin` | `admin123` | Administrator |
| `targetolog` | `target123` | Targetolog |
| `operator1` | `operator123` | Operator |
| `operator2` | `operator123` | Operator |

> ⚠️ Bu loginlar faqat development uchun. **Productionda darhol o'zgartiring** (Sozlamalar → Foydalanuvchilar yoki parolni tiklash).

## 9. Rollar va huquqlar

- **Admin** — to'liq boshqaruv: barcha leadlar, biriktirish, pipeline/custom field/foydalanuvchi sozlamalari, dashboard, audit, o'chirilgan leadlarni tiklash, export.
- **Operator** — faqat o'ziga biriktirilgan + "Ko'rib chiqilmagan" leadlar; statuslarni o'zgartirish, izoh/vazifa/to'lov, o'z statistikasi. Moliya/CAPI/system sozlamalarini ko'rmaydi.
- **Targetolog** — marketing/sotuv statistikasi, moliyaviy holat, Hisobotlar (reklama sarfi), Meta CAPI sozlamalari va loglari. Admin boshqaruv huquqlari yo'q.

## 10. Kiruvchi lead API

Tashqi integratorlar leadni shu endpointga yuboradi:

```
POST /api/integrations/leads
Header:  X-API-Key: <CRM_API_KEY>        (yoki Authorization: Bearer <CRM_API_KEY>)
Header:  Idempotency-Key: <ixtiyoriy>     (takroriy so'rovlardan himoya)
Content-Type: application/json
```

**Payload** (faqat `name` va `phone` majburiy):

```json
{
  "name": "Ali Valiyev",
  "phone": "+998901112233",
  "language_level": "Boshlang'ich",
  "activity": "Talaba",
  "ad_id": "123", "adset_id": "456", "campaign_id": "789",
  "form_id": "111", "lead_id": "fb_lead_1001",
  "campaign_name": "Arab tili - Avgust", "adset_name": "...", "ad_name": "...",
  "utm_source": "instagram", "utm_medium": "cpc", "utm_campaign": "...",
  "utm_content": "...", "utm_term": "...",
  "fbc": "fb.1...", "fbp": "fb.1...",
  "landing_page": "https://...", "source": "facebook",
  "field1": "...", "field2": "...", "field3": "...",
  "second_phone": "+998...", "city": "Toshkent", "profession": "...",
  "custom": { "social_network": "Instagram" }
}
```

**Javoblar:**
- `201` — `{ "ok": true, "id": "...", "status": "unprocessed", "duplicate": false }`
- `200` — idempotency mos kelsa: `{ ..., "duplicate": true }`
- `400` — validatsiya xatosi (`fields` ro'yxati bilan)
- `401` — API kalit noto'g'ri
- `429` — juda ko'p so'rov (rate limit)

Idempotency: `Idempotency-Key` header > `idempotency_key` > `lead_id`. Bir xil odam qayta ariza qoldirsa (boshqa kalit bilan) — **yangi lead** yaratiladi (dublikat bloklanmaydi), lekin lead cardida telefon bo'yicha oldingi arizalar tarixi ko'rinadi.

## 11. Meta CAPI sozlash

1. **Targetolog kabineti** → Meta CAPI sozlamalari.
2. Pixel ID, Access Token (shifrlangan saqlanadi, hech qachon frontendga chiqmaydi), Dataset nomi, Test Event Code kiriting.
3. QualifiedLead ("Sifatli lid" bosqichi) va Purchase ("To'lov qildi" bosqichi) eventlarini yoqing.

Eventlar avtomatik yuboriladi, deterministik `event_id` bilan dublikat oldini oladi. Muvaffaqiyatsiz eventlar avtomatik (transient) yoki qo'lda "Qayta yuborish" tugmasi bilan qayta yuboriladi. Barcha eventlar jurnalda ko'rinadi (token va raw telefon loglanmaydi).

## 12. Telegram bot sozlash

1. [@BotFather](https://t.me/BotFather) orqali bot yarating, tokenni `TELEGRAM_BOT_TOKEN` ga yozing.
2. Webhook o'rnating:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
3. Operator **Profil** sahifasida "Telegramni bog'lash" tugmasini bosadi → kod oladi → botga `/start <kod>` yuboradi.

Bog'langandan so'ng muhim bildirishnomalar (qayta aloqa vaqti, to'lov, lead o'zgarishi) Telegramga ham keladi.

## 13. Production / Railway deployment

1. Railway'da yangi loyiha yarating, GitHub reponi ulang (yoki PostgreSQL plaginini qo'shing).
2. **Environment variables**ni Railway'da to'ldiring (5-bo'lim). `DATABASE_URL` Railway Postgres'dan avtomatik keladi yoki Neon satrini qo'ying.
3. Deploy — `railway.json` avtomatik ishlatiladi:
   - Build: `npm run build` (prisma generate + next build)
   - Start: `npx prisma migrate deploy && npm run start`
4. Birinchi deploydan so'ng (ixtiyoriy) seed: Railway shell'da `npm run db:seed`, keyin admin parolini o'zgartiring.

## 14. Xavfsizlik

- Parollar bcrypt bilan hashlanadi; sessiya tokeni DB'da SHA-256 hash, cookie httpOnly + secure (prod).
- Har API/action serverda avtorizatsiya qiladi (frontend check'ga ishonilmaydi).
- Meta Access Token AES-256-GCM bilan shifrlangan; audit logda maxfiy maydonlar maskalanadi.
- Rate limiting (login va lead API), xavfsizlik headerlari, CSV/JSON validatsiya (zod), ORM (SQL injection himoyasi), React (XSS himoyasi).

## 15. Troubleshooting

- **`P1001: Can't reach database`** — `DATABASE_URL` to'g'riligini, Neon compute uyg'onganini tekshiring.
- **Migratsiya xatosi** — `npm run db:migrate` (dev) yoki `npm run db:deploy` (prod). Sxema o'zgargach `npx prisma generate`.
- **CAPI eventlar FAILED** — Pixel ID / Access Token to'g'riligini, tokenning `events` ruxsatini tekshiring; jurnaldan xatoni ko'ring va "Qayta yuborish".
- **Telegram kelmayapti** — `TELEGRAM_BOT_TOKEN` va webhook o'rnatilganini, operator akkaunti bog'langanini tekshiring.
- **Test sekin** — integratsion testlar real bazaga ulanadi (Neon latency); bu normal.

---

Ishlab chiqilgan: Next.js 16 · Prisma 6 · PostgreSQL · Tailwind v4 · TypeScript (strict).
