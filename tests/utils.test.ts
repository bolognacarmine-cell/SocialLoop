import { describe, expect, it } from "vitest";
import { humanizeEnum, percent, slugify, truncate } from "@/lib/utils";
import { PLATFORM_META, SUPPORTED_PLATFORMS } from "@/lib/social/platforms";

describe("slugify", () => {
  it("normalizes accents and spaces", () => {
    expect(slugify("Guida gratuita al funghetto!")).toBe("guida-gratuita-al-funghetto");
    expect(slugify("  Caffè & Social  ")).toBe("caffe-social");
    expect(slugify("àèìòù")).toBe("aeiou");
  });
});

describe("formatting helpers", () => {
  it("humanizes enums", () => {
    expect(humanizeEnum("LEAD_CREATED")).toBe("Lead Created");
    expect(humanizeEnum("SOCIAL_POST_PUBLISHED")).toBe("Social Post Published");
  });

  it("computes percentages safely", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(0, 0)).toBe(0);
  });

  it("truncates long strings", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
    expect(truncate("short", 20)).toBe("short");
  });
});

describe("platform metadata", () => {
  it("covers every supported platform", () => {
    expect(SUPPORTED_PLATFORMS).toHaveLength(6);
    for (const platform of SUPPORTED_PLATFORMS) {
      expect(PLATFORM_META[platform]).toBeDefined();
      expect(PLATFORM_META[platform].color).toMatch(/^#/);
    }
  });
});
