# Alif CRM — Kiruvchi lead API hujjati

Tashqi integratorlar (Make.com, Albato, Facebook/Target Lead Forms, veb-sayt) leadni shu endpoint orqali CRMga yuboradi.

---

## Endpoint

```
POST {APP_URL}/api/integrations/leads
```

- Lokal (dev): `http://localhost:3000/api/integrations/leads`
- Production: `https://<sizning-domeningiz>/api/integrations/leads`

> ⚠️ Tashqi xizmatlar (Make.com, Target) **`localhost`ga ula olmaydi** — CRM internetда ochiq (public) URL'da bo'lishi kerak (Railway deploy yoki vaqtinchalik tunnel).

## Autentifikatsiya

Har bir so'rov API kalit bilan yuboriladi (ikkisidan biri):

```
X-API-Key: <CRM_API_KEY>
```
yoki
```
Authorization: Bearer <CRM_API_KEY>
```

`Content-Type: application/json` bo'lishi shart.

## Idempotency (takroriy so'rovdan himoya)

Bir xil so'rov ikki marta kelsa (tarmoq qayta urinishi) — yangi lead yaratilmaydi. Kalit quyidagi tartibda aniqlanadi:

1. `Idempotency-Key` header (tavsiya etiladi), yoki
2. body ичидаги `idempotency_key`, yoki
3. body ичидаги `lead_id` (Facebook lead ID)

> Eslatma: bir odam **qayta ariza** qoldirsa (boshqa lead_id bilan) — bu **yangi lead** sifatida qabul qilinadi (dublikat bloklanmaydi). Lead kartasida telefon bo'yicha oldingi arizalar tarixi ko'rinadi.

---

## Maydon parametrlari (body)

Faqat **`name`** va **`phone`** majburiy. Qolganlari ixtiyoriy.

### Asosiy
| Maydon | Turi | Majburiy | Tavsif |
|--------|------|:---:|--------|
| `name` | string | ✅ | Mijoz ismi |
| `phone` | string | ✅ | Telefon raqami (masalan `+998901234567`) |
| `second_phone` | string | — | Ikkinchi raqam |
| `language_level` | string | — | Arab tilini bilish darajasi |
| `activity` | string | — | Faoliyati |
| `city` | string | — | Shahar |
| `profession` | string | — | Kasb |
| `goal` | string | — | Maqsadi |
| `note` | string | — | Izoh (dastlabki) |
| `source` | string | — | Manba (masalan `facebook`, `instagram`, `website`) — sarlavhada ishlatiladi |

### Marketing / attribution
| Maydon | Turi | Tavsif |
|--------|------|--------|
| `ad_id` | string | Reklama (Ad) ID |
| `adset_id` | string | Ad set ID |
| `campaign_id` | string | Campaign ID |
| `form_id` | string | Instant Form ID |
| `lead_id` | string | Facebook Lead ID (idempotency uchun ham) |
| `campaign_name` | string | Campaign nomi |
| `adset_name` | string | Ad set nomi |
| `ad_name` | string | Ad nomi |
| `fbc` | string | Facebook Click ID (`fbclid`dan) |
| `fbp` | string | Facebook browser ID (`_fbp` cookie) |
| `landing_page` | string | Kelib tushgan sahifa URL'i |

### UTM
| Maydon | Turi |
|--------|------|
| `utm_source` | string |
| `utm_medium` | string |
| `utm_campaign` | string |
| `utm_content` | string |
| `utm_term` | string |

### Forma qo'shimcha savollari
| Maydon | Turi | Tavsif |
|--------|------|--------|
| `field1` | string | Formadagi 1-qo'shimcha savol javobi |
| `field2` | string | 2-qo'shimcha savol |
| `field3` | string | 3-qo'shimcha savol |

### Boshqa
| Maydon | Turi | Tavsif |
|--------|------|--------|
| `cookies` | object/any | Cookies snapshot (ixtiyoriy) |
| `custom` | object | Custom fieldlar: `{ "<slug>": <qiymat> }` (masalan `{ "social_network": "Instagram" }`). Faqat CRMда mavjud faol maydon sluglari qabul qilinadi. |
| `idempotency_key` | string | Takroriy so'rov himoyasi (header o'rniga) |

---

## Namunaviy so'rov

```bash
curl -X POST "{APP_URL}/api/integrations/leads" \
  -H "X-API-Key: <CRM_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: fb-lead-1001" \
  -d '{
    "name": "Ali Valiyev",
    "phone": "+998901112233",
    "language_level": "Boshlang'\''ich",
    "activity": "Talaba",
    "source": "facebook",
    "campaign_id": "23851234567890",
    "campaign_name": "Arab tili - Avgust",
    "adset_name": "Toshkent 18-35",
    "ad_name": "Video A",
    "form_id": "111222333",
    "lead_id": "fb-lead-1001",
    "utm_source": "facebook",
    "utm_medium": "paid",
    "utm_campaign": "arab_avgust",
    "fbc": "fb.1.1700000000.AbCdEf",
    "fbp": "fb.1.1700000000.1234567890",
    "landing_page": "https://alifacademy.uz/arab",
    "field1": "Ertalabki guruh",
    "custom": { "social_network": "Instagram" }
  }'
```

## Javoblar

**201 Created** — yangi lead yaratildi:
```json
{ "ok": true, "id": "clx...", "status": "unprocessed", "duplicate": false }
```

**200 OK** — idempotency mos keldi (mavjud lead qaytarildi):
```json
{ "ok": true, "id": "clx...", "status": "unprocessed", "duplicate": true }
```

**400 Bad Request** — validatsiya xatosi:
```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Ma'lumotlar validatsiyadan o'tmadi.",
    "fields": [{ "field": "name", "message": "Ism kerak" }]
  }
}
```

**401 Unauthorized** — API kalit noto'g'ri yoki yo'q:
```json
{ "ok": false, "error": { "code": "unauthorized", "message": "API kalit noto'g'ri yoki yo'q." } }
```

**429 Too Many Requests** — rate limit (daqiqada 120 so'rov / IP):
```json
{ "ok": false, "error": { "code": "rate_limited", "message": "Juda ko'p so'rov...", "retryAfterSec": 42 } }
```

---

## Lead kelgach nima bo'ladi

1. Bazaga yoziladi va **"Ko'rib chiqilmagan"** bosqichiga tushadi.
2. Hech bir operatorga biriktirilmaydi (avtomatik round-robin **yo'q**).
3. Sarlavha avtomatik: `{source}: {name}-{phone}`.
4. Operator/Admin uni Kanban'da "Yangi lead"ga o'tkazganda o'sha operatorga biriktiriladi.

## Make.com / Albato uchun eslatma

- **URL**: `{APP_URL}/api/integrations/leads`
- **Method**: POST
- **Headers**: `X-API-Key: <CRM_API_KEY>`, `Content-Type: application/json`
- **Body**: yuqoridagi maydonlarni Facebook Lead Ads maydonlariga map qiling (`lead_id` → Facebook "Lead ID", `campaign_name` → "Campaign name" va h.k.).
- Idempotency uchun `Idempotency-Key` header'ga Facebook "Lead ID"ni qo'ying.

---

# Call Center Operatori holatini o'zgartirish API (Yoqish / O'chirish)

Operatorlar hisobini (account) vaqtincha nofaol qilish (o'chirish) yoki qayta faollashtirish (yoqish) uchun endpoint.

## Endpoint

```
POST {APP_URL}/api/operators/status
```

## Autentifikatsiya

```
X-API-Key: <CRM_API_KEY>
```
yoki
```
Authorization: Bearer <CRM_API_KEY>
```
*(yoki brauzer orqali tizimga kirgan Admin sessiyasi)*

## Maydon parametrlari (JSON body)

| Maydon | Turi | Tavsif |
|---|---|---|
| `login` | string | Operatorning tizimdagi logini (masalan: `"operator1"`) *(id bo'lmasa majburiy)* |
| `id` | string | Operatorning User ID si (cuid) *(login bo'lmasa majburiy)* |
| `isActive` | boolean | `true` (yoqish / faollashtirish) yoki `false` (o'chirish / nofaol qilish) |
| `action` | string | Muqobil variant: `"activate"`, `"deactivate"`, `"toggle"` |

> 🔒 Eslatma: Hisob nofaol qilinganda (`isActive: false`), ushbu operatorning barcha faol sessiyalari avtomatik ravishda bekor qilinadi (tizimdan chiqarib yuboriladi) va amal audit jurnaliga yoziladi.

### Misollar:

**Operatorni o'chirish (nofaol qilish):**
```bash
curl -X POST "{APP_URL}/api/operators/status" \
  -H "X-API-Key: <CRM_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "login": "operator1",
    "isActive": false
  }'
```

**Operatorni yoqish (faollashtirish):**
```bash
curl -X POST "{APP_URL}/api/operators/status" \
  -H "X-API-Key: <CRM_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "login": "operator1",
    "isActive": true
  }'
```

**Muvaffaqiyatli javob (200 OK):**
```json
{
  "ok": true,
  "message": "Operator 'Operator Ali' (operator1) hisobi muvaffaqiyatli o'chirildi (nofaol qilindi).",
  "operator": {
    "id": "cmum...",
    "name": "Operator Ali",
    "login": "operator1",
    "role": "OPERATOR",
    "isActive": false,
    "updatedAt": "2026-09-29T08:45:45.410Z"
  }
}
```

