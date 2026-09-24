// Khớp luật — PIPELINE.md mục 5.
//
// Thuần TypeScript: không phụ thuộc React, không đụng DOM, nên chạy được cả ở
// client lẫn server và test rất dễ.
//
// Luật khớp giữ nguyên id / source / citation để phiếu kết quả truy được về
// đúng chỗ trong sách (CLAUDE.md mục 1: "Kết quả phải kiểm chứng được").

import type { FaceFeatures } from "../features/types";
import { CATEGORICAL, NUMERIC } from "./accessors";

export type RuleOp =
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "between"
  | "category"
  | "all";

/** Toán tử so sánh số — một vế của luật ghép. */
export type CondOp = "lt" | "lte" | "gt" | "gte" | "between";

/**
 * Một vế của luật op="all".
 *
 * Tướng học có những tướng chỉ thành hình khi NHIỀU nét cùng xuất hiện: mày
 * lưỡi kiếm phải vừa dài quá mắt, vừa trông thẳng, vừa ngược đuôi lên — thiếu
 * một nét là tướng khác hẳn. Tách thành ba luật rời sẽ cộng điểm ba lần cho ba
 * nét lẻ, không phải cho cái tướng ấy.
 */
export type RuleCondition = {
  feature_key: string;
  op: CondOp;
  v_min?: number;
  v_max?: number;
};

export type Rule = {
  id: string;
  feature_key: string;
  op: RuleOp;
  v_min?: number;
  v_max?: number;
  category?: string;
  /** Chỉ có ở op="all": mọi vế phải cùng khớp. */
  conditions?: RuleCondition[];
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

/** So một giá trị đo được với một ngưỡng. undefined = không đọc được => không khớp. */
function compare(
  v: number | undefined,
  op: CondOp,
  v_min?: number,
  v_max?: number
): boolean {
  if (v === undefined || !Number.isFinite(v)) return false;
  switch (op) {
    case "lt":
      return v < (v_max ?? Infinity);
    case "lte":
      return v <= (v_max ?? Infinity);
    case "gt":
      return v > (v_min ?? -Infinity);
    case "gte":
      return v >= (v_min ?? -Infinity);
    case "between":
      return v >= (v_min ?? -Infinity) && v <= (v_max ?? Infinity);
  }
}

export function evaluateRules(f: FaceFeatures, rules: Rule[]): MatchedRule[] {
  const out: MatchedRule[] = [];

  for (const r of rules) {
    if (r.op === "category") {
      const v = CATEGORICAL[r.feature_key]?.(f);
      if (v !== undefined && v === r.category) out.push({ ...r, value: v });
      continue;
    }

    // Luật ghép: mọi vế phải cùng khớp. Giá trị hiển thị lấy số vế đã khớp
    // ("3/3") vì bản thân luật không đo một chỉ số đơn nào.
    if (r.op === "all") {
      const conds = r.conditions ?? [];
      const ok =
        conds.length > 0 &&
        conds.every((c) =>
          compare(NUMERIC[c.feature_key]?.(f), c.op, c.v_min, c.v_max)
        );
      if (ok) out.push({ ...r, value: conds.length + "/" + conds.length });
      continue;
    }

    const v = NUMERIC[r.feature_key]?.(f);
    if (v === undefined) continue; // thiếu accessor -> bỏ qua (xem missingAccessors)

    const ok = compare(v, r.op, r.v_min, r.v_max);
    if (ok) out.push({ ...r, value: v });
  }

  return out;
}
