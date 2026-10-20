import { describe, expect, it } from "vitest";
import { calculateInitialScore, clampScore, scoreTier } from "@/lib/leads/scoring";

describe("calculateInitialScore", () => {
  it("rewards richer profiles", () => {
    const minimal = calculateInitialScore({ email: "a@gmail.com" });
    const full = calculateInitialScore({
      email: "giulia@brightco.io",
      name: "Giulia",
      company: "BrightCo",
      phone: "+39 333 1234567",
      jobTitle: "CMO",
      source: "REFERRAL"
    });
    expect(full).toBeGreaterThan(minimal);
    expect(full).toBeGreaterThan(40);
  });

  it("gives bonus for business email domains", () => {
    const business = calculateInitialScore({ email: "sales@acme.com" });
    const free = calculateInitialScore({ email: "sales@gmail.com" });
    expect(business).toBeGreaterThan(free);
  });

  it("never exceeds the cap", () => {
    const score = calculateInitialScore({
      email: "x@acme.com",
      name: "X",
      company: "Acme",
      phone: "1",
      jobTitle: "CEO",
      source: "REFERRAL"
    });
    expect(score).toBeLessThanOrEqual(1000);
  });
});

describe("score helpers", () => {
  it("clamps values", () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(5000)).toBe(1000);
    expect(clampScore(41.6)).toBe(42);
  });

  it("maps tiers", () => {
    expect(scoreTier(80)).toBe("hot");
    expect(scoreTier(50)).toBe("warm");
    expect(scoreTier(10)).toBe("cold");
  });
});
