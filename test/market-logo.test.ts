import { describe, expect, it } from "vitest";

import { checkLogoUpload, isJpeg, logoStoragePath, MAX_LOGO_BYTES } from "@/lib/markets/logo";

const jpeg = (size = 2000) => {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
const FB = "https://www.facebook.com/EveningMarketTroyTX/";

describe("logoStoragePath", () => {
  it("is the same path the website scan writes", () => {
    expect(logoStoragePath("TX", "an-evening-market-at-troy-tx")).toBe("tx/an-evening-market-at-troy-tx.jpg");
  });
});

describe("isJpeg", () => {
  it("reads the bytes, not the file name", () => {
    expect(isJpeg(jpeg())).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG
    expect(isJpeg(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe(false);
    expect(isJpeg(new Uint8Array())).toBe(false);
  });
});

describe("checkLogoUpload", () => {
  it("accepts a small JPEG with a source page", () => {
    expect(checkLogoUpload(jpeg(), FB)).toEqual({ ok: true, sourceUrl: FB });
  });

  it("refuses an empty, oversized or non-JPEG upload", () => {
    expect(checkLogoUpload(new Uint8Array(), FB).ok).toBe(false);
    expect(checkLogoUpload(jpeg(MAX_LOGO_BYTES + 1), FB).ok).toBe(false);
    expect(checkLogoUpload(new Uint8Array([1, 2, 3, 4]), FB).ok).toBe(false);
  });

  it("needs to know where the picture came from, and that it is a web page", () => {
    expect(checkLogoUpload(jpeg(), null).ok).toBe(false);
    expect(checkLogoUpload(jpeg(), "").ok).toBe(false);
    expect(checkLogoUpload(jpeg(), "javascript:alert(1)").ok).toBe(false);
  });
});
