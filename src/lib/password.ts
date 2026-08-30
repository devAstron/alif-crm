import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Parolni bcrypt bilan hashlash. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

/** Parolni hash bilan solishtirish. */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
