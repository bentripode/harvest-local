import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Authenticated encryption for the one secret we hold: a seller's SSN or EIN.
 *
 * AES-256-GCM, key from `TAX_ID_ENCRYPTION_KEY` (32 bytes, base64). The key lives only in the
 * application environment — Postgres never sees it, so a database dump, a backup, or a leaked
 * service-role key yields ciphertext and nothing else.
 *
 * GCM is authenticated: a tampered ciphertext fails to decrypt rather than returning garbage.
 *
 * The stored format is `v1.<base64url(iv | tag | ciphertext)>`. The version prefix exists so a key
 * rotation can be introduced later without guessing at what old rows contain.
 */

const VERSION = "v1";
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      "TAX_ID_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to " +
        ".env.local (and the deployment environment) before collecting tax IDs.",
    );
    this.name = "MissingEncryptionKeyError";
  }
}

/** True when the platform is configured to accept tax IDs at all. */
export function encryptionConfigured(): boolean {
  return !!env.TAX_ID_ENCRYPTION_KEY;
}

function key(): Buffer {
  if (!env.TAX_ID_ENCRYPTION_KEY) throw new MissingEncryptionKeyError();
  const raw = Buffer.from(env.TAX_ID_ENCRYPTION_KEY, "base64");
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `TAX_ID_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${raw.length}. ` +
        "Generate one with `openssl rand -base64 32`.",
    );
  }
  return raw;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

/**
 * Nothing in the app calls this today — every screen renders `tax_id_last4` instead. It exists for
 * a tax-reporting export, which is the only reason the number is kept at all. Whatever calls it
 * must write a `decrypted` row to `tax_id_audit`.
 */
export function decryptSecret(payload: string): string {
  const [version, body] = payload.split(".", 2);
  if (version !== VERSION || !body) {
    throw new Error(`Unrecognised ciphertext format: ${version ?? "(empty)"}`);
  }

  const raw = Buffer.from(body, "base64url");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** The last 4 digits — the only part of a tax ID any screen is allowed to show. */
export function lastFourDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
