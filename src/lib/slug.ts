/** O'zbekcha/lotin matndan barqaror slug hosil qiladi. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    "'": "", "ʻ": "", "ʼ": "", "`": "",
    " ": "-",
  };
  const base = input
    .toLowerCase()
    .trim()
    .split("")
    .map((c) => (c in map ? map[c] : c))
    .join("")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "item";
}

/** Ro'yxatda takrorlanmaydigan slug (kerak bo'lsa raqam qo'shadi). */
export function uniqueSlug(base: string, existing: Set<string>): string {
  const slug = slugify(base);
  if (!existing.has(slug)) return slug;
  let i = 2;
  while (existing.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}
