import { describe, expect, it } from "vitest";
import { CAREERS, RULES } from "../data";
import { evaluateRules } from "../engine/rule-engine";
import { scoreCareers } from "../engine/career";
import canonical from "./__fixtures__/canonical_face.json";
import { BOVI_KEYS, type BoVi } from "./bovi";
import { extractFeatures } from "./features";
import { BOVI_PT as B, PT, SHAPE_PT as S } from "./landmark-ids";
import type { Landmark } from "./types";

// Khuôn mặt trung bình của chính MediaPipe (canonical_face_model.obj), khung
// vuông 1000 px. Mô hình gốc có 468 điểm; 10 điểm tròng mắt được dựng thêm từ
// khoé mắt với đường kính bằng 0.39 bề ngang mắt.
const FRAME = { width: 1000, height: 1000 };
const face = (): Landmark[] => structuredClone(canonical) as Landmark[];
const bovi = (lm: Landmark[], frame = FRAME): BoVi =>
  extractFeatures(lm, { frame }).bovi as BoVi;

describe("đo bộ vị trên khuôn mặt trung bình của MediaPipe", () => {
  it("các chỉ số co giãn đều rơi quanh giữa thang", () => {
    const b = bovi(face());
    for (const k of [
      "glabella_width",
      "nasion_height",
      "nose_length",
      "nose_ridge_width",
      "nose_tip_height",
      "nose_tip_size",
      "philtrum_length",
      "philtrum_taper",
      "eye_spacing",
      "eye_depth",
      "iris_ratio",
      "chin_length",
    ] as const) {
      expect(b[k], k).toBeGreaterThan(0.35);
      expect(b[k], k).toBeLessThan(0.65);
    }
  });

  it("khuôn mặt cân đối thì các chỉ số độ ngay đạt tối đa", () => {
    const b = bovi(face());
    expect(b.nose_straightness).toBeCloseTo(1, 3);
    expect(b.philtrum_straightness).toBeCloseTo(1, 3);
    expect(b.mouth_level).toBeCloseTo(1, 3);
  });

  it("không đổi khi phóng to, dời ảnh hoặc nghiêng đầu", () => {
    const base = bovi(face());
    const th = (5 * Math.PI) / 180;
    const moved = face().map((p) => ({
      x: 0.45 + 0.7 * (p.x - 0.5) * Math.cos(th) - 0.7 * (p.y - 0.5) * Math.sin(th),
      y: 0.55 + 0.7 * (p.x - 0.5) * Math.sin(th) + 0.7 * (p.y - 0.5) * Math.cos(th),
      z: (p.z ?? 0) * 0.7,
    }));
    const after = bovi(moved);
    for (const k of BOVI_KEYS) expect(after[k], k).toBeCloseTo(base[k], 2);
  });

  it("đúng cả với khung 16:9", () => {
    const wide = { width: 1600, height: 900 };
    const lm = face().map((p) => ({
      x: 0.5 + ((p.x - 0.5) * 900) / 1600,
      y: p.y,
      z: ((p.z ?? 0) * 900) / 1600,
    }));
    const a = bovi(lm, wide);
    const b = bovi(face(), { width: 900, height: 900 });
    for (const k of BOVI_KEYS) expect(a[k], k).toBeCloseTo(b[k], 2);
  });
});

describe("mỗi chỉ số phản ứng đúng với bộ vị của nó", () => {
  const moved = (fn: (lm: Landmark[]) => void) => {
    const lm = face();
    fn(lm);
    return bovi(lm);
  };
  const base = bovi(face());

  it("ấn đường rộng ra khi hai đầu mày tách xa nhau", () => {
    const b = moved((lm) => {
      lm[B.BROW_INNER_R].x -= 0.01;
      lm[B.BROW_INNER_L].x += 0.01;
    });
    expect(b.glabella_width).toBeGreaterThan(base.glabella_width + 0.2);
  });

  it("sơn căn cao lên khi điểm giữa hai mắt nhô ra", () => {
    const b = moved((lm) => {
      lm[PT.NASION].z = (lm[PT.NASION].z ?? 0) - 0.015;
    });
    expect(b.nasion_height).toBeGreaterThan(base.nasion_height + 0.3);
  });

  it("sống mũi lệch thì độ ngay giảm", () => {
    const b = moved((lm) => {
      lm[195].x += 0.006;
    });
    expect(b.nose_straightness).toBeLessThan(0.7);
  });

  it("nhân trung dài ra khi môi trên hạ xuống", () => {
    const b = moved((lm) => {
      lm[PT.LIP_UPPER_OUTER].y += 0.005;
    });
    expect(b.philtrum_length).toBeGreaterThan(base.philtrum_length + 0.2);
  });

  it("hai mắt xa nhau làm tăng khoảng cách mắt", () => {
    const b = moved((lm) => {
      lm[PT.EYE_R_INNER].x -= 0.006;
      lm[PT.EYE_L_INNER].x += 0.006;
    });
    expect(b.eye_spacing).toBeGreaterThan(base.eye_spacing + 0.2);
  });

  it("cằm hẹp lại khi hai bên cằm thu vào", () => {
    const b = moved((lm) => {
      lm[S.CHIN_L].x += 0.015;
      lm[S.CHIN_R].x -= 0.015;
    });
    expect(b.chin_width).toBeLessThan(base.chin_width - 0.2);
  });

  it("một bên khoé miệng thấp hơn thì miệng kém ngay ngắn", () => {
    const b = moved((lm) => {
      lm[PT.MOUTH_L].y += 0.003;
    });
    expect(b.mouth_level).toBeLessThan(0.7);
  });
});

describe("thiếu dữ liệu thì luật không khớp", () => {
  it("không có trục z: các luật đọc độ sâu không khớp, số đo khác vẫn còn", () => {
    const lm = face().map(({ x, y }) => ({ x, y }));
    const f = extractFeatures(lm, { frame: FRAME });
    expect(f.bovi?.nasion_height).toBeNaN();
    expect(f.bovi?.glabella_width).toBeGreaterThan(0);
    const ids = evaluateRules(f, RULES).map((m) => m.id);
    expect(ids).not.toContain("nasion_high");
    expect(ids).not.toContain("nose_tip_high");
    expect(ids).not.toContain("eye_deep");
  });
});

describe("toàn bộ luật trên khuôn mặt trung bình", () => {
  it("chấm được đủ các nhóm nghề và không nhóm nào chiếm trọn", () => {
    const f = extractFeatures(face(), { frame: FRAME });
    const scores = scoreCareers(evaluateRules(f, RULES), RULES, CAREERS);
    expect(scores).toHaveLength(CAREERS.length);
    expect(scores[0].percent).toBeLessThan(90);
  });
});
