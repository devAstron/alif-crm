/** Domen (business logic) xatolari — server action'lar foydalanuvchiga o'zbekcha xabar qaytaradi. */

export class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DomainError";
  }
}

/** Ruxsat yo'q. */
export class ForbiddenError extends DomainError {
  constructor(message = "Bu amalni bajarishga ruxsatingiz yo'q.") {
    super("forbidden", message);
    this.name = "ForbiddenError";
  }
}

/** Majburiy fieldlar to'ldirilmagan. */
export class RequiredFieldsError extends DomainError {
  missing: { key: string; label: string }[];
  constructor(missing: { key: string; label: string }[]) {
    const labels = missing.map((m) => m.label).join(", ");
    super("required_fields", `Quyidagi maydonlar to'ldirilishi shart: ${labels}`);
    this.missing = missing;
    this.name = "RequiredFieldsError";
  }
}

/** Server action natijasi (UI uchun). */
export interface ActionResult<T = never> {
  ok: boolean;
  error?: string;
  code?: string;
  missing?: { key: string; label: string }[];
  data?: T;
}

/** Domen xatosini ActionResult ga aylantiradi. Noma'lum xatolar qayta throw qilinadi (server log). */
export function toActionError(error: unknown): ActionResult {
  if (error instanceof RequiredFieldsError) {
    return { ok: false, error: error.message, code: error.code, missing: error.missing };
  }
  if (error instanceof DomainError) {
    return { ok: false, error: error.message, code: error.code };
  }
  throw error;
}
