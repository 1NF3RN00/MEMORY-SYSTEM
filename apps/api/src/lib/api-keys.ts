import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ApiKeyPermission } from "@memory-middleware/shared-types";

const KEY_PREFIX = "mw_live_";
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_KEY_LEN = 32;

export function generateRawApiKey(): string {
  const body = randomBytes(24).toString("base64url");
  return `${KEY_PREFIX}${body}`;
}

export function hashApiKey(rawKey: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(rawKey, salt, SCRYPT_KEY_LEN);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const [saltHex, derivedHex] = storedHash.split(":");
  if (!saltHex || !derivedHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(derivedHex, "hex");
    const derived = scryptSync(rawKey, salt, expected.length);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function extractKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, 16);
}

export function fingerprintApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex").slice(0, 12);
}

export function parsePermissions(value: unknown): ApiKeyPermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is ApiKeyPermission => typeof p === "string");
}
