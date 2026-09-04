import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Authenticated encryption for the one secret we hold: a seller's SSN or EIN.
 *
 * AES-256-GCM. The key material lives only in the application environment — Postgres never sees it,
 * so a database dump, a backup, or a leaked service-role key yields ciphertext and nothing else.
 * GCM is authenticated: a tampered ciphertext fails to decrypt rather than returning garbage.
 *
 * ## Keyring and rotation
 *
 * `TAX_ID_ENCRYPTION_KEYS` is a comma-separated list of `id:base64key`, e.g. `2:AAA…,1:BBB…`.
 * **The highest id is the active key** — rotating is "add a higher-numbered key", with no second
 * variable to keep in sync and so no way for the two to disagree. Older keys stay in the list so
 * their rows still decrypt, and `tax-id-rekey` moves those rows onto the active key; once it
 * reports nothing left on an old id, that key can be dropped from the list.
 *
 * `TAX_ID_ENCRYPTION_KEY` (singular) is still accepted and means exactly `1:<key>`, so a
 * deployment that never rotates needs no extra ceremony.
 *
 * ## Stored formats
 *
 *   `v1.<base64url(iv | tag | ciphertext)>`             — pre-rotation, always key id 1
 *   `v2.<keyId>.<base64url(iv | tag | ciphertext)>`     — current
 *
 * v1 is read-only history: everything written now is v2, and `tax-id-rekey` converts v1 rows as it
 * goes. `seller_licenses.tax_id_key_id` mirrors the id in the ciphertext so the job can find
 * candidates — and an admin can count them — without decrypting anything.
 */

const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** The id v1 ciphertext is understood to have been written with. */
export const LEGACY_KEY_ID = 1;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      "No tax-ID encryption key is configured. Generate one with `openssl rand -base64 32` and set " +
        "TAX_ID_ENCRYPTION_KEYS=1:<key> (or TAX_ID_ENCRYPTION_KEY=<key>) in the environment.",
    );
    this.name = "MissingEncryptionKeyError";
  }
}

export class UnknownKeyIdError extends Error {
  constructor(keyId: number) {
    super(
      `Tax-ID ciphertext references key ${keyId}, which is not in TAX_ID_ENCRYPTION_KEYS. The key ` +
        "was retired before every row was re-encrypted — restore it and let tax-id-rekey finish.",
    );
    this.name = "UnknownKeyIdError";
  }
}

/** id → 32-byte key, parsed once. */
function keyring(): Map<number, Buffer> {
  const ring = new Map<number, Buffer>();

  const add = (id: number, b64: string) => {
    const raw = Buffer.from(b64, "base64");
    if (raw.length !== KEY_BYTES) {
      throw new Error(
        `Tax-ID key ${id} must decode to ${KEY_BYTES} bytes, got ${raw.length}. ` +
          "Generate one with `openssl rand -base64 32`.",
      );
    }
    ring.set(id, raw);
  };

  if (env.TAX_ID_ENCRYPTION_KEYS) {
    for (const entry of env.TAX_ID_ENCRYPTION_KEYS.split(",")) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const separator = trimmed.indexOf(":");
      if (separator < 1) {
        throw new Error(`Malformed TAX_ID_ENCRYPTION_KEYS entry: expected "id:base64key".`);
      }
      const id = Number(trimmed.slice(0, separator));
      if (!Number.isInteger(id) || id < 1) {
        throw new Error(`Malformed TAX_ID_ENCRYPTION_KEYS entry: key id must be a positive integer.`);
      }
      add(id, trimmed.slice(separator + 1));
    }
  }

  // The singular form is the keyring with one entry. It loses to an explicit id 1 in the list.
  if (env.TAX_ID_ENCRYPTION_KEY && !ring.has(LEGACY_KEY_ID)) {
    add(LEGACY_KEY_ID, env.TAX_ID_ENCRYPTION_KEY);
  }

  return ring;
}

/** True when the platform is configured to accept tax IDs at all. */
export function encryptionConfigured(): boolean {
  try {
    return keyring().size > 0;
  } catch {
    // A malformed keyring is a misconfiguration, not "unconfigured" — surface it on use.
    return false;
  }
}

/** The key new ciphertext is written with: the highest id in the ring. */
export function activeKeyId(): number {
  const ring = keyring();
  if (ring.size === 0) throw new MissingEncryptionKeyError();
  return Math.max(...ring.keys());
}

function keyFor(id: number): Buffer {
  const ring = keyring();
  if (ring.size === 0) throw new MissingEncryptionKeyError();
  const key = ring.get(id);
  if (!key) throw new UnknownKeyIdError(id);
  return key;
}

export interface Encrypted {
  ciphertext: string;
  keyId: number;
}

export function encryptSecret(plaintext: string): Encrypted {
  const keyId = activeKeyId();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(keyId), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: `v2.${keyId}.${Buffer.concat([iv, tag, body]).toString("base64url")}`,
    keyId,
  };
}

/** Which key a stored value was written with, without decrypting it. */
export function keyIdOf(payload: string): number {
  const parts = payload.split(".");
  if (parts[0] === "v1") return LEGACY_KEY_ID;
  if (parts[0] === "v2") {
    const id = Number(parts[1]);
    if (Number.isInteger(id) && id >= 1) return id;
  }
  throw new Error(`Unrecognised ciphertext format: ${parts[0] ?? "(empty)"}`);
}

/**
 * Only `tax-id-rekey` and a future tax-reporting export call this. Whatever does must write a
 * `decrypted` or `rekeyed` row to `tax_id_audit`.
 */
export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  const keyId = keyIdOf(payload);
  const body = parts[0] === "v1" ? parts[1] : parts[2];
  if (!body) throw new Error("Ciphertext is missing its payload.");

  const raw = Buffer.from(body, "base64url");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", keyFor(keyId), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Re-encrypt under the active key. Returns null when the row is already current. */
export function rekeySecret(payload: string): Encrypted | null {
  if (keyIdOf(payload) === activeKeyId()) return null;
  return encryptSecret(decryptSecret(payload));
}

/** The last 4 digits — the only part of a tax ID any screen is allowed to show. */
export function lastFourDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
