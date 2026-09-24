import { describe, expect, it } from "vitest";
import { RULES } from "../data";
import { CATEGORICAL, NUMERIC, readKeys } from "../engine/accessors";
import { analyzeFeatures } from "../engine/analyze";
import { normalizeFeatures } from "./migrate";
import type { FaceFeatures } from "./types";

// Bộ đặc trưng đúng như bản TRƯỚC v4 lưu xuống localStorage: không có `shape`,
// không có cheekbone.height, không có eyebrows.tailRise.
const LEGACY = {
  faceType: "kim",
  santing: { upper: 0.37, middle: 0.32, lower: 0.31, balance: 0.88, dominant: "upper" },
  forehead: { width: 0.74, shape: "vuong" },
  eyes: { length: 1.04, size: 0.52 },
  cheekbone: { prominence: 0.63 },
  eyebrows: { curvature: 0.42, length: 1.05, thickness: 0.7, eyeGap: 0.55 },
  nose: { wingWidth: 0.55, bridgeWidth: 0.5, length: 0.52 },
  mouth: { width: 0.65, thickness: 0.5, cornerAngle: 0.1, shape: "vong_cung" },
  quality: { landmarks: 478, headTiltDeg: -2, brightness: 0.78, ok: true },
};

describe("normalizeFeatures", () => {
  it("lượt quét cũ mở lại được, không nổ khi dựng phiếu", () => {
    const f = normalizeFeatures(structuredClone(LEGACY));
    expect(f).not.toBeNull();
    const r = analyzeFeatures(f as FaceFeatures);
    expect(r.archetype).toBeTruthy();
    expect(r.careers.length).toBeGreaterThan(0);
  });

  it("mọi chỉ số bộ luật dùng tới đều đọc được sau khi vá", () => {
    const f = normalizeFeatures(structuredClone(LEGACY)) as FaceFeatures;
    const unreadable = [...new Set(RULES.flatMap(readKeys))]
      .filter((k) => {
        const read = NUMERIC[k] ?? CATEGORICAL[k];
        return read === undefined || read(f) === undefined;
      })
      .sort();
    expect(unreadable).toEqual([]);
    // Hai chỉ số của v4 không có trong bản cũ: điền 0 (= "ngang", trung tính)
    // chứ không để undefined, vì undefined làm luật im lặng không khớp.
    expect(f.cheekbone.height).toBe(0);
    expect(f.eyebrows.tailRise).toBe(0);
  });

  it("KHÔNG nhận vơ là đã đo được: ngũ hình cũ chỉ còn là gợi ý", () => {
    const f = normalizeFeatures(structuredClone(LEGACY)) as FaceFeatures;
    // faceType cũ được giữ để phiếu dựng lại được...
    expect(f.faceType).toBe("kim");
    // ...nhưng nó do bản phân loại CŨ chấm, nên không được coi là chắc chắn.
    expect(f.shape.measured).toBe(false);
    expect(f.shape.confident).toBe(false);
    expect(analyzeFeatures(f).faceTypeConfident).toBe(false);
  });

  it("bộ đặc trưng bản mới đi qua nguyên vẹn", () => {
    const fresh = normalizeFeatures(structuredClone(LEGACY)) as FaceFeatures;
    const again = normalizeFeatures(fresh);
    expect(again).toBe(fresh);
  });

  it("dữ liệu hỏng thì trả null chứ không trả nửa vời", () => {
    expect(normalizeFeatures(null)).toBeNull();
    expect(normalizeFeatures({})).toBeNull();
    expect(normalizeFeatures({ ...LEGACY, faceType: "khong_co" })).toBeNull();
    expect(normalizeFeatures({ ...LEGACY, mouth: undefined })).toBeNull();
  });
});
