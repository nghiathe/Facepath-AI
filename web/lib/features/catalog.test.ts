import { describe, expect, it } from "vitest";
import { RULES } from "../data";
import { SUPPORTED_KEYS } from "../engine/accessors";
import { describeCondition } from "../engine/describe";
import { FEATURE_KEYS, FEATURE_LABELS, featureLayer } from "./catalog";

// Danh mục này là bản chép của api/rules/features.py, và trang "Khám phá" dựa
// hẳn vào nó. Ba bài dưới đây giữ cho nó không lệch khỏi rules.json/accessors.
describe("danh mục chỉ số", () => {
  it("mọi feature_key trong rules.json đều có nhãn", () => {
    const missing = [...new Set(RULES.map((r) => r.feature_key))].filter(
      (k) => !(k in FEATURE_LABELS)
    );
    expect(missing).toEqual([]);
  });

  it("không có nhãn thừa so với accessors của engine", () => {
    expect([...FEATURE_KEYS].sort()).toEqual([...SUPPORTED_KEYS].sort());
  });

  it("mỗi chỉ số thuộc đúng một lớp bóc tách", () => {
    for (const k of FEATURE_KEYS) expect(featureLayer(k)).not.toBe("Khác");
  });

  it("mọi luật diễn giải được thành chữ, không rơi vào nhánh mặc định", () => {
    for (const r of RULES) {
      const text = describeCondition(r);
      expect(text, r.id).not.toBe(r.op);
      expect(text).not.toContain("?");
    }
  });
});
