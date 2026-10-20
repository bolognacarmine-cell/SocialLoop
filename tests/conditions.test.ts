import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  evaluateConditionGroup,
  getFieldValue,
  workflowTriggerMatches
} from "@/lib/workflows/conditions";
import type { WorkflowContext } from "@/lib/workflows/types";

const context: WorkflowContext = {
  email: "giulia@brightco.io",
  name: "Giulia",
  score: 72,
  stage: "QUALIFIED",
  tags: ["hot-lead", "newsletter"],
  custom: { plan: "pro", seats: 5 }
};

describe("getFieldValue", () => {
  it("reads nested paths", () => {
    expect(getFieldValue(context, "custom.plan")).toBe("pro");
    expect(getFieldValue(context, "missing.deep")).toBeUndefined();
  });
});

describe("evaluateCondition", () => {
  it("compares numeric fields", () => {
    expect(evaluateCondition({ field: "score", operator: "greater_than", value: 50 }, context)).toBe(true);
    expect(evaluateCondition({ field: "score", operator: "less_than", value: 50 }, context)).toBe(false);
  });

  it("supports string operations", () => {
    expect(evaluateCondition({ field: "email", operator: "contains", value: "brightco" }, context)).toBe(true);
    expect(evaluateCondition({ field: "email", operator: "not_equals", value: "other@acme.com" }, context)).toBe(true);
  });

  it("works with arrays via in/equals", () => {
    expect(evaluateCondition({ field: "tags", operator: "equals", value: "hot-lead" }, context)).toBe(true);
    expect(evaluateCondition({ field: "tags", operator: "in", value: ["cold", "newsletter"] }, context)).toBe(true);
  });

  it("checks existence", () => {
    expect(evaluateCondition({ field: "name", operator: "exists" }, context)).toBe(true);
    expect(evaluateCondition({ field: "phone", operator: "not_exists" }, context)).toBe(true);
  });
});

describe("evaluateConditionGroup", () => {
  it("defaults to true with no rules", () => {
    expect(evaluateConditionGroup({ match: "all", rules: [] }, context)).toBe(true);
    expect(evaluateConditionGroup(null, context)).toBe(true);
  });

  it("respects all/any matching", () => {
    const rules = [
      { field: "score", operator: "greater_or_equal" as const, value: 70 },
      { field: "stage", operator: "equals" as const, value: "WON" }
    ];
    expect(evaluateConditionGroup({ match: "all", rules }, context)).toBe(false);
    expect(evaluateConditionGroup({ match: "any", rules }, context)).toBe(true);
  });
});

describe("workflowTriggerMatches", () => {
  it("checks tag, stage and score filters", () => {
    expect(workflowTriggerMatches({ match: "all", rules: [], tag: "hot-lead" }, context)).toBe(true);
    expect(workflowTriggerMatches({ match: "all", rules: [], tag: "webinar" }, context)).toBe(false);
    expect(workflowTriggerMatches({ match: "all", rules: [], stage: "QUALIFIED" }, context)).toBe(true);
    expect(workflowTriggerMatches({ match: "all", rules: [], minScore: 80 }, context)).toBe(false);
  });
});
