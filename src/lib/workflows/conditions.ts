import type {
  Condition,
  ConditionGroup,
  TriggerConfig,
  WorkflowContext
} from "./types";

export function getFieldValue(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function toComparable(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function includesValue(source: unknown, target: unknown): boolean {
  if (Array.isArray(source)) {
    return source.some((item) => normalize(item) === normalize(target));
  }
  return normalize(source).includes(normalize(target));
}

export function evaluateCondition(condition: Condition, data: Record<string, unknown>): boolean {
  const field = getFieldValue(data, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "equals": {
      if (Array.isArray(field)) return field.some((item) => normalize(item) === normalize(expected));
      return normalize(field) === normalize(expected);
    }
    case "not_equals": {
      if (Array.isArray(field)) return field.every((item) => normalize(item) !== normalize(expected));
      return normalize(field) !== normalize(expected);
    }
    case "contains":
      return includesValue(field, expected);
    case "not_contains":
      return !includesValue(field, expected);
    case "greater_than":
      return Number(field) > Number(expected);
    case "greater_or_equal":
      return Number(field) >= Number(expected);
    case "less_than":
      return Number(field) < Number(expected);
    case "less_or_equal":
      return Number(field) <= Number(expected);
    case "exists":
      return field !== undefined && field !== null && field !== "";
    case "not_exists":
      return field === undefined || field === null || field === "";
    case "in": {
      const values = Array.isArray(expected)
        ? expected
        : String(expected ?? "")
            .split(",")
            .map((value) => value.trim());
      if (Array.isArray(field)) {
        return field.some((item) => values.some((value) => normalize(value) === normalize(item)));
      }
      return values.some((value) => normalize(value) === normalize(field));
    }
    case "not_in": {
      const values = Array.isArray(expected)
        ? expected
        : String(expected ?? "")
            .split(",")
            .map((value) => value.trim());
      if (Array.isArray(field)) {
        return field.every((item) => values.every((value) => normalize(value) !== normalize(item)));
      }
      return values.every((value) => normalize(value) !== normalize(field));
    }
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup | null | undefined,
  data: Record<string, unknown>
): boolean {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) return true;
  const results = group.rules.map((rule) => evaluateCondition(rule, data));
  return group.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function workflowTriggerMatches(
  config: TriggerConfig | null | undefined,
  data: WorkflowContext
): boolean {
  if (!config) return true;
  if (config.tag) {
    const tags = Array.isArray(data.tags) ? data.tags.map(normalize) : [];
    if (!tags.includes(normalize(config.tag))) return false;
  }
  if (config.stage && normalize(data.stage) !== normalize(config.stage)) return false;
  if (typeof config.minScore === "number" && Number(data.score ?? 0) < config.minScore) {
    return false;
  }
  return evaluateConditionGroup(config, data);
}

export function compareValues(a: unknown, b: unknown): number {
  const left = toComparable(a);
  const right = toComparable(b);
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}
