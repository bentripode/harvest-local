import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The tax-ID cipher. `env` is validated at import time, so the key is stubbed before the module
 * under test is loaded.
 */

const KEY = Buffer.alloc(32, 7).toString("base64");

vi.mock("@/lib/env", () => ({ env: { TAX_ID_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") } }));

let secretBox: typeof import("@/lib/crypto/secret-box");

beforeAll(async () => {
  secretBox = await import("@/lib/crypto/secret-box");
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a value", () => {
    const ciphertext = secretBox.encryptSecret("123-45-6789");
    expect(secretBox.decryptSecret(ciphertext)).toBe("123-45-6789");
  });

  it("never emits the plaintext", () => {
    expect(secretBox.encryptSecret("123-45-6789")).not.toContain("6789");
  });

  it("produces a different ciphertext every time (fresh IV)", () => {
    const a = secretBox.encryptSecret("123-45-6789");
    const b = secretBox.encryptSecret("123-45-6789");
    expect(a).not.toBe(b);
    expect(secretBox.decryptSecret(a)).toBe(secretBox.decryptSecret(b));
  });

  it("carries a version prefix so the format can change later", () => {
    expect(secretBox.encryptSecret("123456789").startsWith("v1.")).toBe(true);
  });

  it("refuses a tampered ciphertext rather than returning garbage", () => {
    const ciphertext = secretBox.encryptSecret("123-45-6789");
    const flipped = `${ciphertext.slice(0, -2)}${ciphertext.at(-2) === "A" ? "B" : "A"}=`;
    expect(() => secretBox.decryptSecret(flipped)).toThrow();
  });

  it("refuses an unknown format", () => {
    expect(() => secretBox.decryptSecret("v9.abcdef")).toThrow(/Unrecognised ciphertext/);
  });

  it("reports itself configured when a key is present", () => {
    expect(secretBox.encryptionConfigured()).toBe(true);
    expect(KEY).toHaveLength(44);
  });
});

describe("lastFourDigits", () => {
  it("strips formatting", () => {
    expect(secretBox.lastFourDigits("123-45-6789")).toBe("6789");
  });

  it("handles an EIN", () => {
    expect(secretBox.lastFourDigits("12-3456789")).toBe("6789");
  });

  it("returns nothing when there aren't 4 digits", () => {
    expect(secretBox.lastFourDigits("12")).toBeNull();
  });
});
