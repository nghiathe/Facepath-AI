import { describe, expect, it } from "vitest";
import { CAREERS, FACE_TYPES, formatSource, getSource, RULES } from "../data";
import type { FaceFeatures } from "../features/types";
import { missingAccessors, SUPPORTED_KEYS } from "./accessors";
import { scoreCareers } from "./career";
import { evaluateRules, type Rule } from "./rule-engine";
import { aggregateTraits, slugify, topTraits } from "./traits";

/** Một bộ đặc trưng dựng tay, không cần đi qua landmarks. */
function features(over: Partial<FaceFeatures> = {}): FaceFeatures {
  return {
    faceType: "kim",
    santing: {
      upper: 0.33,
      middle: 0.34,
      lower: 0.33,
      balance: 0.95,
      dominant: "balanced",
    },
    forehead: { width: 0.72, shape: "vuong" },
    eyes: { length: 1.02, size: 0.5 },
    cheekbone: { prominence: 0.55 },
    eyebrows: { curvature: 0.4, length: 1.05, thickness: 0.7, eyeGap: 0.55 },
    nose: { wingWidth: 0.55, bridgeWidth: 0.5, length: 0.5 },
    mouth: {
      width: 0.65,
      thickness: 0.5,
      cornerAngle: 0.1,
      shape: "vong_cung",
    },
    quality: { landmarks: 478, headTiltDeg: 0, brightness: 0.8, ok: true },
    ...over,
  };
}

// --- Dữ liệu và code không được lệch nhau -----------------------------------
describe("dữ liệu khớp với engine", () => {
  it("mọi feature_key trong rules.json đều có accessor", () => {
    expect(missingAccessors(RULES.map((r) => r.feature_key))).toEqual([]);
  });

  it("rules.json dùng đúng 19 feature_key như PIPELINE mục 1", () => {
    expect(new Set(RULES.map((r) => r.feature_key)).size).toBe(19);
    expect(RULES).toHaveLength(32);
  });

  it("mọi luật đều truy được về nguồn có thật", () => {
    for (const r of RULES) {
      expect(getSource(r.source), "thiếu nguồn: " + r.source).toBeDefined();
      expect(r.citation.length).toBeGreaterThan(0);
    }
  });

  it("mọi slug nghề trong rules đều có trong careers.json", () => {
    const known = new Set(CAREERS.map((c) => c.slug));
    for (const r of RULES)
      for (const slug of Object.keys(r.careers)) expect(known.has(slug)).toBe(true);
  });

  it("category của face_shape khớp face_types.json", () => {
    const inRules = new Set(
      RULES.filter((r) => r.feature_key === "face_shape").map((r) => r.category)
    );
    expect(inRules).toEqual(new Set(FACE_TYPES.map((f) => f.key)));
  });

  // Chiều ngược lại của test đầu tiên. Accessor thừa = engine đọc một đặc trưng
  // chẳng luật nào dùng: hoặc luật bị xoá nhầm, hoặc tên gõ lệch một bên. Nêu
  // đích danh key thừa thay vì chỉ so số lượng, để lần sau khỏi phải đi dò.
  it("không accessor nào thừa so với rules.json", () => {
    const used = new Set(RULES.map((r) => r.feature_key));
    expect(SUPPORTED_KEYS.filter((k) => !used.has(k))).toEqual([]);
  });
});

// --- Khớp luật --------------------------------------------------------------
describe("evaluateRules", () => {
  const mk = (over: Partial<Rule>): Rule => ({
    id: "t",
    feature_key: "mouth_width",
    op: "gt",
    trait: "T",
    reading_hint: "h",
    source: "may",
    citation: "c",
    weight: 1,
    careers: {},
    ...over,
  });

  it("so sánh số theo đúng từng toán tử", () => {
    const f = features({
      mouth: { width: 0.5, thickness: 0.5, cornerAngle: 0, shape: "khac" },
    });
    const hit = (r: Partial<Rule>) => evaluateRules(f, [mk(r)]).length === 1;

    expect(hit({ op: "gt", v_min: 0.4 })).toBe(true);
    expect(hit({ op: "gt", v_min: 0.5 })).toBe(false); // biên: gt loại giá trị bằng
    expect(hit({ op: "gte", v_min: 0.5 })).toBe(true);
    expect(hit({ op: "lt", v_max: 0.6 })).toBe(true);
    expect(hit({ op: "lt", v_max: 0.5 })).toBe(false);
    expect(hit({ op: "lte", v_max: 0.5 })).toBe(true);
    expect(hit({ op: "between", v_min: 0.4, v_max: 0.6 })).toBe(true);
    expect(hit({ op: "between", v_min: 0.6, v_max: 0.8 })).toBe(false);
  });

  it("khớp phân loại theo category", () => {
    const f = features({ faceType: "moc" });
    const r = mk({ feature_key: "face_shape", op: "category", category: "moc" });
    expect(evaluateRules(f, [r])).toHaveLength(1);
    expect(evaluateRules(f, [{ ...r, category: "kim" }])).toHaveLength(0);
  });

  it("bỏ qua luật có feature_key chưa có accessor, không ném lỗi", () => {
    const r = mk({ feature_key: "chua_ton_tai", op: "gt", v_min: 0 });
    expect(() => evaluateRules(features(), [r])).not.toThrow();
    expect(evaluateRules(features(), [r])).toHaveLength(0);
  });

  it("luật khớp giữ nguyên id, source, citation và giá trị đã đo", () => {
    const f = features({ faceType: "kim" });
    const matched = evaluateRules(f, RULES);
    const kim = matched.find((m) => m.id === "face_kim");
    expect(kim).toBeDefined();
    expect(kim!.source).toBe("may");
    expect(kim!.citation).toContain("Ngũ hành hình tướng");
    expect(kim!.value).toBe("kim");
  });

  it("chạy được trên toàn bộ 26 luật thật và có luật khớp", () => {
    const matched = evaluateRules(features(), RULES);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.length).toBeLessThanOrEqual(RULES.length);
  });
});

// --- Trait ------------------------------------------------------------------
describe("aggregateTraits", () => {
  it("slugify bỏ dấu tiếng Việt", () => {
    expect(slugify("Kiên định, bền chí")).toBe("kien-dinh-ben-chi");
    expect(slugify("Đường hoàng")).toBe("duong-hoang");
  });

  it("score nằm trong 0..1 và giữ được nguồn dẫn", () => {
    const matched = evaluateRules(features(), RULES);
    const traits = aggregateTraits(matched, RULES);
    expect(traits.length).toBeGreaterThan(0);
    for (const t of traits) {
      expect(t.score).toBeGreaterThan(0);
      expect(t.score).toBeLessThanOrEqual(1);
      expect(t.rules.length).toBeGreaterThan(0);
      for (const r of t.rules) {
        expect(getSource(r.source)).toBeDefined();
        expect(r.citation.length).toBeGreaterThan(0);
      }
    }
  });

  it("sắp giảm dần và cắt được top N cho phiếu", () => {
    const traits = aggregateTraits(evaluateRules(features(), RULES), RULES);
    for (let i = 1; i < traits.length; i++)
      expect(traits[i - 1].score).toBeGreaterThanOrEqual(traits[i].score);
    expect(topTraits(traits, 4)).toHaveLength(Math.min(4, traits.length));
  });

  it("một trait được nhiều luật chống lưng thì score phản ánh mức phủ", () => {
    // Dữ liệu thật đang là 1 luật / 1 trait nên score luôn 1.0; ở đây dựng
    // trường hợp 2 luật cùng trait để chứng minh công thức mục 6 đúng.
    const base = {
      trait: "Chung",
      reading_hint: "h",
      source: "may",
      citation: "c",
      careers: {},
    };
    const all: Rule[] = [
      { ...base, id: "a", feature_key: "mouth_width", op: "gt", v_min: 0.1, weight: 1 },
      { ...base, id: "b", feature_key: "mouth_width", op: "gt", v_min: 0.9, weight: 3 },
    ];
    const matched = evaluateRules(
      features({ mouth: { width: 0.5, thickness: 0.5, cornerAngle: 0, shape: "khac" } }),
      all
    );
    expect(matched).toHaveLength(1); // chỉ luật "a" khớp
    const [t] = aggregateTraits(matched, all);
    expect(t.score).toBeCloseTo(1 / 4, 10); // weight 1 trên tổng 4
  });
});

// --- Chấm điểm nghề ---------------------------------------------------------
describe("scoreCareers", () => {
  it("trả đủ 6 nhóm nghề, percent 0..100, sắp giảm dần", () => {
    const matched = evaluateRules(features(), RULES);
    const scores = scoreCareers(matched, RULES, CAREERS);

    expect(scores).toHaveLength(6);
    for (const s of scores) {
      expect(s.percent).toBeGreaterThanOrEqual(0);
      expect(s.percent).toBeLessThanOrEqual(100);
      expect(Number.isInteger(s.percent)).toBe(true);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.sample_jobs.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < scores.length; i++)
      expect(scores[i - 1].percent).toBeGreaterThanOrEqual(scores[i].percent);
  });

  it("không luật nào khớp thì mọi nghề đều 0", () => {
    const scores = scoreCareers([], RULES, CAREERS);
    expect(scores.every((s) => s.percent === 0)).toBe(true);
  });

  it("khớp hết mọi luật thì mọi nghề đều 100", () => {
    const all = RULES.map((r) => ({ ...r, value: 0 }));
    const scores = scoreCareers(all, RULES, CAREERS);
    expect(scores.every((s) => s.percent === 100)).toBe(true);
  });

  it("đếm đúng số luật khớp cho từng nghề", () => {
    const matched = evaluateRules(features(), RULES);
    const scores = scoreCareers(matched, RULES, CAREERS);
    for (const s of scores) {
      const expected = matched.filter((m) => s.slug in m.careers).length;
      expect(s.matchedRules).toBe(expected);
    }
  });
});

// --- Xuyên suốt -------------------------------------------------------------
describe("end-to-end: features -> luật -> trait -> nghề", () => {
  it("chạy trọn chuỗi và mọi trait hiển thị đều truy được nguồn", () => {
    const f = features({ faceType: "thuy" });

    const matched = evaluateRules(f, RULES);
    const traits = topTraits(aggregateTraits(matched, RULES), 6);
    const careers = scoreCareers(matched, RULES, CAREERS);

    expect(matched.length).toBeGreaterThan(0);
    expect(traits.length).toBeGreaterThan(0);
    expect(careers).toHaveLength(6);

    // Đúng nguyên tắc CLAUDE.md mục 1: mọi nét hiển thị đều tra ngược được.
    for (const t of traits)
      for (const r of t.rules)
        expect(formatSource(r.source, r.citation)).not.toContain("undefined");

    // Nhóm nghề dẫn đầu phải thực sự có luật chống lưng.
    expect(careers[0].matchedRules).toBeGreaterThan(0);
  });

  it("khuôn mặt khác nhau cho kết quả khác nhau", () => {
    const kim = scoreCareers(
      evaluateRules(features({ faceType: "kim" }), RULES),
      RULES,
      CAREERS
    );
    const moc = scoreCareers(
      evaluateRules(features({ faceType: "moc" }), RULES),
      RULES,
      CAREERS
    );
    expect(kim.map((c) => c.percent)).not.toEqual(moc.map((c) => c.percent));
  });
});
