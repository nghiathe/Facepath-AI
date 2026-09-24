import { describe, expect, it } from "vitest";
import { DEMO_SCAN } from "../demo";
import { applyModelFusion } from "./features";
import { MODEL_CLASSES } from "./shape";
import type { FaceFeatures } from "./types";

// Trộn xác suất model vào kết quả hình học — bước chạy ở màn 03.
//
// VÌ SAO ĐÁNG TEST RIÊNG: hàm này đổi `faceType`, mà `faceType` lại là thứ các
// luật face_* chấm theo và là tiêu đề của cả phiếu. Sai ở đây thì không có gì
// nổ ra cả, chỉ là phiếu nói sai một cách êm ái.

const base: FaceFeatures = DEMO_SCAN.features;
const probs = (cls: string, p = 0.9) =>
  MODEL_CLASSES.map((c) => (c === cls ? p : (1 - p) / (MODEL_CLASSES.length - 1)));

describe("applyModelFusion", () => {
  it("không sửa tại chỗ — bộ đặc trưng gốc giữ nguyên", () => {
    const before = JSON.stringify(base);
    const out = applyModelFusion(base, probs("Square"));
    expect(JSON.stringify(base)).toBe(before);
    expect(out).not.toBe(base);
  });

  it("model tự tin Square thì Kim được cộng thêm", () => {
    const out = applyModelFusion(base, probs("Square"));
    const p = (f: FaceFeatures, k: string) =>
      f.shape.membership.find((m) => m.key === k)?.p ?? 0;
    expect(p(out, "kim")).toBeGreaterThan(p(base, "kim"));
    expect(out.shape.usedModel).toBe(true);
  });

  it("model lưỡng lự thì không trộn, nhưng vẫn ghi lại là đã thử", () => {
    const flat = MODEL_CLASSES.map(() => 1 / MODEL_CLASSES.length);
    const out = applyModelFusion(base, flat);
    expect(out.shape.usedModel).toBe(false);
    expect(out.shape.membership).toEqual(base.shape.membership);
    // modelProbs vẫn được lưu: báo cáo đồ án cần biết model đã nói gì.
    expect(out.shape.modelProbs).toEqual(flat);
  });

  it("faceType luôn bám theo hành dẫn đầu sau khi trộn", () => {
    for (const c of MODEL_CLASSES) {
      const out = applyModelFusion(base, probs(c));
      expect(out.faceType, c).toBe(out.shape.membership[0].key);
      expect(out.shape.membership.reduce((a, b) => a + b.p, 0)).toBeCloseTo(1, 10);
    }
  });

  it("model KHÔNG đụng tới bất cứ chỉ số đo được nào", () => {
    const out = applyModelFusion(base, probs("Round"));
    // Nếu model lỡ sửa được các chỉ số này thì nó sẽ gián tiếp đẻ ra trait và
    // trích dẫn — đúng điều data/README.md cấm.
    expect(out.santing).toEqual(base.santing);
    expect(out.eyebrows).toEqual(base.eyebrows);
    expect(out.nose).toEqual(base.nose);
    expect(out.mouth).toEqual(base.mouth);
    expect(out.cheekbone).toEqual(base.cheekbone);
    expect(out.shape.raw).toEqual(base.shape.raw);
    expect(out.shape.z).toEqual(base.shape.z);
  });

  it("Oval — lớp không ứng với hành nào — giữ nguyên phân bố hình học", () => {
    const out = applyModelFusion(base, probs("Oval", 1));
    for (const m of out.shape.membership) {
      const b = base.shape.membership.find((x) => x.key === m.key)!;
      expect(m.p).toBeCloseTo(b.p, 10);
    }
  });
});
