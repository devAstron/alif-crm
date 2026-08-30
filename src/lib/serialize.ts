/**
 * BigInt qiymatlar JSON.stringify tomonidan qo'llab-quvvatlanmaydi.
 * Server komponentdan clientga uzatishdan oldin BigInt -> string/number ga o'giramiz.
 */

/** BigInt (so'm) ni raqamga o'giradi. Katta summalar uchun ehtiyot: Number xavfsiz chegara ~9e15. */
export function bigIntToNumber(value: bigint | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

/** Ob'ekt ichidagi barcha BigInt'larni number'ga rekursiv o'giradi (client uchun). */
export function serializeBigInt<T>(input: T): T {
  return JSON.parse(
    JSON.stringify(input, (_key, value) =>
      typeof value === "bigint" ? Number(value) : value,
    ),
  ) as T;
}

/** Guruh ajratgichlarni (NBSP, narrow NBSP, vergul) oddiy probelga normallashtiradi. */
function normalizeGroups(s: string): string {
  return s.replace(/[  ,\s]/g, " ");
}

/** So'm summani o'zbekcha formatda: 1 500 000 so'm */
export function formatSom(value: bigint | number | null | undefined): string {
  if (value == null) return "0 so'm";
  const n = typeof value === "bigint" ? Number(value) : value;
  return normalizeGroups(new Intl.NumberFormat("uz-UZ").format(n)) + " so'm";
}

/** Raqamni guruhlangan formatda (so'm so'zisiz). */
export function formatNumber(value: bigint | number | null | undefined): string {
  if (value == null) return "0";
  const n = typeof value === "bigint" ? Number(value) : value;
  return normalizeGroups(new Intl.NumberFormat("uz-UZ").format(n));
}
