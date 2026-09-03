// Khớp luật — PIPELINE.md mục 5.
//
// Thuần TypeScript: không phụ thuộc React, không đụng DOM, nên chạy được cả ở
// client lẫn server và test rất dễ.
//
// Luật khớp giữ nguyên id / source / citation để phiếu kết quả truy được về
// đúng chỗ trong sách (CLAUDE.md mục 1: "Kết quả phải kiểm chứng được").

import type { FaceFeatures } from "../features/types";
import { CATEGORICAL, NUMERIC } from "./accessors";

export type RuleOp = "lt" | "lte" | "gt" | "gte" | "between" | "category";

export type Rule = {
  id: string;
  feature_key: string;
  op: RuleOp;
  v_min?: number;
  v_max?: number;
  category?: string;
  trait: string;
  reading_hint: string;
  /** id của nguồn, trỏ vào data/sources.json (vd "may"), không phải tên sách. */
  source: string;
  citation: string;
  weight: number;
  /** slug nhóm nghề -> trọng số 0..1. */
  careers: Record<string, number>;
};

export type MatchedRule = Rule & { value: number | string };

export function evaluateRules(f: FaceFeatures, rules: Rule[]): MatchedRule[] {
  const out: MatchedRule[] = [];

  for (const r of rules) {
    if (r.op === "category") {
      const v = CATEGORICAL[r.feature_key]?.(f);
      if (v !== undefined && v === r.category) out.push({ ...r, value: v });
      continue;
    }

    const v = NUMERIC[r.feature_key]?.(f);
    if (v === undefined) continue; // thiếu accessor -> bỏ qua (xem missingAccessors)

    const ok =
      r.op === "lt"
        ? v < (r.v_max ?? Infinity)
        : r.op === "lte"
          ? v <= (r.v_max ?? Infinity)
          : r.op === "gt"
            ? v > (r.v_min ?? -Infinity)
            : r.op === "gte"
              ? v >= (r.v_min ?? -Infinity)
              : r.op === "between"
                ? v >= (r.v_min ?? -Infinity) && v <= (r.v_max ?? Infinity)
                : false;

    if (ok) out.push({ ...r, value: v });
  }

  return out;
}
