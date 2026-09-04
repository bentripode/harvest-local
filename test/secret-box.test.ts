import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tax-ID cipher and its keyring.
 *
 * `keyring()` reads `env` on every call, so the mocked env object can be mutated between cases to
 * stand in for a deployment mid-rotation.
 */

const KEY_1 = Buffer.alloc(32, 1).toString("base64");
const KEY_2 = Buffer.alloc(32, 2).toString("base64");
const KEY_3 = Buffer.alloc(32, 3).toString("base64");

const mockEnv: { TAX_ID_ENCRYPTION_KEYS?: string; TAX_ID_ENCRYPTION_KEY?: string } = {};

vi.mock("@/lib/env", () => ({ env: mockEnv }));

let box: typeof import("@/lib/crypto/secret-box");

beforeAll(async () => {
  box = await import("@/lib/crypto/secret-box");
});

afterEach(() => {
  delete mockEnv.TAX_ID_ENCRYPTION_KEYS;
  delete mockEnv.TAX_ID_ENCRYPTION_KEY;
});

describe("keyring configuration", () => {
  it("accepts the singular key as id 1", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEY = KEY_1;
    expect(box.encryptionConfigured()).toBe(true);
    expect(box.activeKeyId()).toBe(1);
  });

  it("treats the highest id in the list as active", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},3:${KEY_3},2:${KEY_2}`;
    expect(box.activeKeyId()).toBe(3);
  });

  it("prefers an explicit id 1 over the singular form", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_2}`;
    mockEnv.TAX_ID_ENCRYPTION_KEY = KEY_1;
    const { ciphertext } = box.encryptSecret("123456789");
    mockEnv.TAX_ID_ENCRYPTION_KEY = undefined;
    expect(box.decryptSecret(ciphertext)).toBe("123456789");
  });

  it("reports unconfigured when there is no key at all", () => {
    expect(box.encryptionConfigured()).toBe(false);
    expect(() => box.activeKeyId()).toThrow(/No tax-ID encryption key/);
  });

  it("rejects a key of the wrong length", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${Buffer.alloc(16, 9).toString("base64")}`;
    expect(() => box.encryptSecret("123456789")).toThrow(/must decode to 32 bytes/);
  });

  it("rejects a malformed entry", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = KEY_1; // no `id:` prefix
    expect(() => box.activeKeyId()).toThrow(/Malformed/);
  });
});

describe("encryptSecret / decryptSecret", () => {
  beforeEach(() => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1}`;
  });

  it("round-trips a value", () => {
    const { ciphertext } = box.encryptSecret("123-45-6789");
    expect(box.decryptSecret(ciphertext)).toBe("123-45-6789");
  });

  it("never emits the plaintext", () => {
    expect(box.encryptSecret("123-45-6789").ciphertext).not.toContain("6789");
  });

  it("produces a different ciphertext every time (fresh IV)", () => {
    const a = box.encryptSecret("123-45-6789").ciphertext;
    const b = box.encryptSecret("123-45-6789").ciphertext;
    expect(a).not.toBe(b);
    expect(box.decryptSecret(a)).toBe(box.decryptSecret(b));
  });

  it("writes the v2 format, tagged with the key id", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},2:${KEY_2}`;
    const { ciphertext, keyId } = box.encryptSecret("123456789");
    expect(ciphertext.startsWith("v2.2.")).toBe(true);
    expect(keyId).toBe(2);
    expect(box.keyIdOf(ciphertext)).toBe(2);
  });

  it("refuses a tampered ciphertext rather than returning garbage", () => {
    const { ciphertext } = box.encryptSecret("123-45-6789");
    const flipped = `${ciphertext.slice(0, -2)}${ciphertext.at(-2) === "A" ? "B" : "A"}=`;
    expect(() => box.decryptSecret(flipped)).toThrow();
  });

  it("refuses an unknown format", () => {
    expect(() => box.decryptSecret("v9.abcdef")).toThrow(/Unrecognised ciphertext/);
  });

  it("says which key is missing when one was retired too early", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},2:${KEY_2}`;
    const { ciphertext } = box.encryptSecret("123456789");
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1}`;
    expect(() => box.decryptSecret(ciphertext)).toThrow(/references key 2/);
  });
});

describe("rotation", () => {
  it("still reads v1 ciphertext as key 1", () => {
    // A row written before the keyring existed: `v1.<payload>`, no key id.
    mockEnv.TAX_ID_ENCRYPTION_KEY = KEY_1;
    const legacy = legacyV1("123-45-6789", KEY_1);
    expect(box.keyIdOf(legacy)).toBe(box.LEGACY_KEY_ID);
    expect(box.decryptSecret(legacy)).toBe("123-45-6789");
  });

  it("rekeys a v1 row onto the active key", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},2:${KEY_2}`;
    const legacy = legacyV1("123-45-6789", KEY_1);

    const next = box.rekeySecret(legacy);
    expect(next).not.toBeNull();
    expect(next!.keyId).toBe(2);
    expect(box.decryptSecret(next!.ciphertext)).toBe("123-45-6789");
  });

  it("rekeys across two rotations", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1}`;
    const first = box.encryptSecret("123-45-6789").ciphertext;

    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},2:${KEY_2}`;
    const second = box.rekeySecret(first)!;
    expect(second.keyId).toBe(2);

    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},2:${KEY_2},3:${KEY_3}`;
    const third = box.rekeySecret(second.ciphertext)!;
    expect(third.keyId).toBe(3);
    expect(box.decryptSecret(third.ciphertext)).toBe("123-45-6789");
  });

  it("leaves a row that is already current alone", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},2:${KEY_2}`;
    const { ciphertext } = box.encryptSecret("123456789");
    expect(box.rekeySecret(ciphertext)).toBeNull();
  });

  it("the retired key is no longer needed once a row is rekeyed", () => {
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `1:${KEY_1},2:${KEY_2}`;
    const rekeyed = box.rekeySecret(legacyV1("123-45-6789", KEY_1))!;

    // Drop key 1, as the runbook says to once nothing is left on it.
    mockEnv.TAX_ID_ENCRYPTION_KEYS = `2:${KEY_2}`;
    expect(box.decryptSecret(rekeyed.ciphertext)).toBe("123-45-6789");
  });
});

describe("lastFourDigits", () => {
  it("strips formatting", () => {
    expect(box.lastFourDigits("123-45-6789")).toBe("6789");
  });

  it("handles an EIN", () => {
    expect(box.lastFourDigits("12-3456789")).toBe("6789");
  });

  it("returns nothing when there aren't 4 digits", () => {
    expect(box.lastFourDigits("12")).toBeNull();
  });
});

/** Builds a pre-keyring `v1.` value the way the shipped code used to. */
function legacyV1(plaintext: string, keyBase64: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCipheriv, randomBytes } = require("node:crypto") as typeof import("node:crypto");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyBase64, "base64"), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}
