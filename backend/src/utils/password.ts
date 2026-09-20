import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with 10 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validates standard email address format.
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim();
  if (!normalized || normalized.length > 254) return false;
  // Standard RFC 5322 compatible regex for email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(normalized);
}

/**
 * Validates password requirement (minimum 8 characters).
 */
export function isValidPassword(password: unknown): { valid: boolean; message?: string } {
  if (typeof password !== "string") {
    return { valid: false, message: "Password must be a string." };
  }
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long." };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password must not exceed 128 characters." };
  }
  return { valid: true };
}
