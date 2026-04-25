import type { RuleCondition, RuleEvalResult } from "./types";

/**
 * 조건 평가기. 모든 조건이 AND 결합으로 만족되어야 matched=true.
 *
 * field 경로는 점 표기법 지원: 'member.tier', 'payment.amount' 등.
 */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function evaluateConditions(
  conditions: RuleCondition[],
  payload: Record<string, unknown>,
): RuleEvalResult {
  const failed: string[] = [];

  for (const c of conditions) {
    const lhs = getByPath(payload, c.field);
    let pass = false;

    switch (c.op) {
      case "eq":
        pass = lhs === c.value;
        break;
      case "ne":
        pass = lhs !== c.value;
        break;
      case "gte":
        pass = typeof lhs === "number" && typeof c.value === "number" && lhs >= c.value;
        break;
      case "lte":
        pass = typeof lhs === "number" && typeof c.value === "number" && lhs <= c.value;
        break;
      case "gt":
        pass = typeof lhs === "number" && typeof c.value === "number" && lhs > c.value;
        break;
      case "lt":
        pass = typeof lhs === "number" && typeof c.value === "number" && lhs < c.value;
        break;
      case "in":
        pass = Array.isArray(c.value) && c.value.includes(lhs);
        break;
      case "contains":
        pass =
          typeof lhs === "string" && typeof c.value === "string" && lhs.includes(c.value);
        break;
      default:
        pass = false;
    }

    if (!pass) failed.push(`${c.field} ${c.op} ${JSON.stringify(c.value)} (got ${JSON.stringify(lhs)})`);
  }

  return { matched: failed.length === 0, failedConditions: failed };
}
