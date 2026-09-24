// Diễn giải một luật ra chữ đọc được — dùng cho trang "Khám phá".
//
// Chỉ là lớp hiển thị: điều kiện thật vẫn do rule-engine.ts chấm. Giữ hai hàm
// tách nhau (điều kiện / giá trị đo được) để trang tra cứu và phiếu kết quả
// dùng chung một cách gọi tên ngưỡng.

import { categoryLabel, featureLabel } from "../features/catalog";
import type { Rule, RuleCondition } from "./rule-engine";

const n = (v: number | undefined) => (v === undefined ? "?" : v.toFixed(2));

/** Một vế của luật ghép, vd "Độ cong cung mày < 0.40". */
const describeSub = (c: RuleCondition): string =>
  featureLabel(c.feature_key) +
  " " +
  (c.op === "lt"
    ? "< " + n(c.v_max)
    : c.op === "lte"
      ? "≤ " + n(c.v_max)
      : c.op === "gt"
        ? "> " + n(c.v_min)
        : c.op === "gte"
          ? "≥ " + n(c.v_min)
          : "trong " + n(c.v_min) + " – " + n(c.v_max));

/** vd "< 0.50", "≥ 0.36", "trong 0.32 – 0.35", "là mặt chữ Nhật — kim hình". */
export function describeCondition(r: Rule): string {
  switch (r.op) {
    case "category":
      return "là " + categoryLabel(r.category ?? "?");
    case "all":
      // Luật ghép: liệt kê đủ các vế, vì "khớp" ở đây nghĩa là khớp tất cả.
      return (
        "khi đủ cả: " + (r.conditions ?? []).map(describeSub).join("; ")
      );
    case "lt":
      return "< " + n(r.v_max);
    case "lte":
      return "≤ " + n(r.v_max);
    case "gt":
      return "> " + n(r.v_min);
    case "gte":
      return "≥ " + n(r.v_min);
    case "between":
      return "trong " + n(r.v_min) + " – " + n(r.v_max);
    default:
      return r.op;
  }
}

/** vd "Bề rộng cánh mũi ≥ 0.60" — một dòng đủ nghĩa cho danh sách tra cứu. */
export const describeRule = (r: Rule): string =>
  featureLabel(r.feature_key) + " " + describeCondition(r);
