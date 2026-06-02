import { ulid } from "ulid";

/** Generate a new canonical ULID (26-char Crockford base32). */
export function newUlid(): string {
  return ulid();
}

const ULID_REGEX = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export function isUlid(value: string): boolean {
  return ULID_REGEX.test(value);
}
