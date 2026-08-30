import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, hashToken, sha256, maskSecret } from "@/lib/crypto";
import { slugify, uniqueSlug } from "@/lib/slug";
import { formatSom, formatNumber, serializeBigInt } from "@/lib/serialize";
import { tashkentDayRange, presetRange, tashkentDateKey } from "@/lib/datetime";
import { buildPayload } from "@/lib/capi/client";
import { normalizePhone } from "@/lib/phone";

describe("crypto", () => {
  it("shifrlash va deshifrlash aylanma", () => {
    const secret = "META_ACCESS_TOKEN_xyz_123";
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("buzilgan shifrni null qaytaradi", () => {
    expect(decryptSecret("noto'g'ri")).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  it("token hash barqaror", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("sha256 to'g'ri uzunlik", () => {
    expect(sha256("test")).toHaveLength(64);
  });

  it("maskSecret oxirgi belgilarni ko'rsatadi", () => {
    expect(maskSecret("1234567890")).toBe("••••7890");
    expect(maskSecret("")).toBe("");
  });
});

describe("slug", () => {
  it("o'zbekcha nomni slug qiladi", () => {
    expect(slugify("Sifatli lid")).toBe("sifatli-lid");
    expect(slugify("To'lov qildi")).toBe("tolov-qildi");
  });
  it("takrorlanmaydigan slug", () => {
    const existing = new Set(["test", "test-2"]);
    expect(uniqueSlug("Test", existing)).toBe("test-3");
    expect(uniqueSlug("Yangi", existing)).toBe("yangi");
  });
});

describe("serialize / money", () => {
  it("so'm formatlash guruhlangan", () => {
    expect(formatSom(1500000)).toBe("1 500 000 so'm");
    expect(formatSom(0)).toBe("0 so'm");
    expect(formatNumber(1000000)).toBe("1 000 000");
  });
  it("BigInt ni number ga serializ qiladi", () => {
    const out = serializeBigInt({ amount: 500000n, nested: { x: 10n } });
    expect(out.amount).toBe(500000);
    expect(out.nested.x).toBe(10);
  });
});

describe("datetime (Asia/Tashkent)", () => {
  it("kun oralig'i start < end", () => {
    const { start, end } = tashkentDayRange(new Date("2026-08-25T10:00:00Z"));
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
  it("preset today == kun oralig'i", () => {
    const r = presetRange("today");
    expect(r.preset).toBe("today");
  });
  it("custom oralig'i sanalarni oladi", () => {
    const r = presetRange("custom", "2026-08-01", "2026-08-31");
    expect(tashkentDateKey(r.start)).toBe("2026-08-01");
    expect(tashkentDateKey(r.end)).toBe("2026-08-31");
  });
});

describe("telefon normalizatsiyasi (+998)", () => {
  it("9 raqamli mahalliy raqamga +998 qo'shadi", () => {
    expect(normalizePhone("950049559")).toBe("+998950049559");
    expect(normalizePhone("91 725 55 98")).toBe("+998917255598");
    expect(normalizePhone("77.0400825")).toBe("+998770400825");
  });
  it("to'liq +998 raqamni saqlaydi", () => {
    expect(normalizePhone("+998990601779")).toBe("+998990601779");
    expect(normalizePhone("998990601779")).toBe("+998990601779");
  });
  it("bo'sh qiymatlarni xavfsiz ishlaydi", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });
});

describe("CAPI payload xavfsizligi", () => {
  it("telefon hashlangan, raw yo'q; token payloadда yo'q", () => {
    const payload = buildPayload("Purchase", {
      id: "lead1", name: "Ali", phone: "+998901112233",
      externalLeadId: null, fbc: "fb.1.x", fbp: "fb.1.y", value: 500000,
    }, "Purchase:lead1");
    const str = JSON.stringify(payload);
    expect(str).not.toContain("998901112233"); // raw telefon yo'q
    expect(str).toContain("ph"); // hash bor
    const event = payload.data[0] as Record<string, unknown>;
    expect(event.event_id).toBe("Purchase:lead1");
    expect((event.custom_data as Record<string, unknown>).value).toBe(500000);
    expect((event.custom_data as Record<string, unknown>).currency).toBe("UZS");
  });
});
