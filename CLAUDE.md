# Alif CRM — loyiha yo'riqnomasi (Claude uchun)

Alif Academy Arab tili kursi uchun single-tenant Sales CRM. UI faqat **o'zbek tilida**. To'liq spetsifikatsiya: `~/Downloads/online_kurslar_crm_claude_code_master_prompt.md`. Qarorlar: `DECISIONS.md`.

## Stack
Next.js 16 (App Router, TS strict) · Prisma 6 + Neon Postgres · Tailwind v4 · custom session auth · zod · date-fns-tz (`Asia/Tashkent`) · vitest.

## Muhim qoidalar
- Pul = `BigInt` (butun so'm). Client'ga `serializeBigInt`.
- Vaqt UTC'da saqlanadi, `Asia/Tashkent`da ko'rsatiladi (`src/lib/datetime.ts`).
- Har API/action serverda `requireUser`/`requireRole` bilan avtorizatsiya qilsin.
- Maxfiy ma'lumot (token, parol) audit/logga tushmasin; access token AES-GCM bilan shifrlanadi.
- Bosqich sluglari barqaror (ingliz), UI nomlari o'zbekcha (`src/lib/constants.ts`).

## Buyruqlar
```
npm run dev        # ishga tushirish
npm run db:migrate # migratsiya (dev)
npm run db:seed    # seed
npm run typecheck && npm run lint && npm run build   # har bosqich oxirida
```

## Seed loginlar (faqat dev)
admin/admin123 · targetolog/target123 · operator1|operator2 / operator123
