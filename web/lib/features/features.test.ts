import { describe, expect, it } from "vitest";
import {
  classifyFaceType,
  classifyMouthShape,
  extractFeatures,
} from "./features";
import {
  FACE_OVAL,
  LEFT_EYE,
  LEFT_EYEBROW,
  LIPS,
  PT,
  RIGHT_EYE,
  RIGHT_EYEBROW,
  TOTAL_LANDMARKS,
} from "./landmark-ids";
import type { Landmark } from "./types";

// --- Bộ dựng khuôn mặt giả --------------------------------------------------
// Dựng đủ 478 điểm để extractFeatures chạy được. Các mốc chia tam đình đặt
// tường minh nên kiểm chứng được bằng tay.

type FaceOpts = {
  topY?: number;
  chinY?: number;
  browY?: number;
  noseBaseY?: number;
  faceHalfW?: number;
  jawHalfW?: number;
  mouthHalfW?: number;
  browArc?: number; // độ vồng của cung mày
};

function synthFace(o: FaceOpts = {}): Landmark[] {
  const topY = o.topY ?? 0.1;
  const chinY = o.chinY ?? 0.9;
  const h = chinY - topY;
  const browY = o.browY ?? topY + h / 3;
  const noseBaseY = o.noseBaseY ?? topY + (2 * h) / 3;
  const halfW = o.faceHalfW ?? 0.2;
  const jawHalfW = o.jawHalfW ?? halfW * 0.85;
  const mouthHalfW = o.mouthHalfW ?? 0.08;
  const arc = o.browArc ?? 0;
  const cx = 0.5;

  const lm: Landmark[] = Array.from({ length: TOTAL_LANDMARKS }, () => ({
    x: cx,
    y: (topY + chinY) / 2,
  }));

  // Đường viền mặt: nửa trên rộng halfW, nửa dưới thu về jawHalfW.
  FACE_OVAL.forEach((id, i) => {
    const t = (i / FACE_OVAL.length) * Math.PI * 2;
    const y = (topY + chinY) / 2 + (Math.cos(t) * -h) / 2;
    const w = y > topY + h * 0.7 ? jawHalfW : halfW;
    lm[id] = { x: cx + Math.sin(t) * w, y };
  });
  lm[PT.FOREHEAD_TOP] = { x: cx, y: topY };
  lm[PT.CHIN_BOTTOM] = { x: cx, y: chinY };
  // Ép hai mép rộng nhất để faceW đúng bằng 2*halfW.
  lm[PT.CHEEK_RIGHT] = { x: cx - halfW, y: (topY + chinY) / 2 };
  lm[PT.CHEEK_LEFT] = { x: cx + halfW, y: (topY + chinY) / 2 };

  // Mắt: hai cụm nhỏ, khoé ngoài cách nhau 0.2 => iod = 0.2
  const eyeY = browY + 0.05;
  const eyeSpan = 0.1;
  lm[PT.EYE_R_OUTER] = { x: cx - eyeSpan, y: eyeY };
  lm[PT.EYE_R_INNER] = { x: cx - eyeSpan / 2.5, y: eyeY };
  lm[PT.EYE_L_INNER] = { x: cx + eyeSpan / 2.5, y: eyeY };
  lm[PT.EYE_L_OUTER] = { x: cx + eyeSpan, y: eyeY };
  RIGHT_EYE.forEach((id, i) => {
    const f = i / Math.max(1, RIGHT_EYE.length - 1);
    lm[id] = { x: cx - eyeSpan + f * (eyeSpan - eyeSpan / 2.5), y: eyeY };
  });
  LEFT_EYE.forEach((id, i) => {
    const f = i / Math.max(1, LEFT_EYE.length - 1);
    lm[id] = { x: cx + eyeSpan / 2.5 + f * (eyeSpan - eyeSpan / 2.5), y: eyeY };
  });
  // Đặt lại khoé ngoài (vòng lặp trên có thể ghi đè).
  lm[PT.EYE_R_OUTER] = { x: cx - eyeSpan, y: eyeY };
  lm[PT.EYE_L_OUTER] = { x: cx + eyeSpan, y: eyeY };

  // Cung mày: mọi điểm ở đúng browY (cộng độ vồng) để mean y = browY.
  const placeBrow = (ids: number[], x0: number, x1: number) => {
    ids.forEach((id, i) => {
      const f = ids.length === 1 ? 0.5 : i / (ids.length - 1);
      const dy = arc === 0 ? 0 : -arc * Math.sin(f * Math.PI);
      lm[id] = { x: x0 + f * (x1 - x0), y: browY + dy };
    });
  };
  placeBrow(RIGHT_EYEBROW, cx - eyeSpan * 1.1, cx - eyeSpan * 0.3);
  placeBrow(LEFT_EYEBROW, cx + eyeSpan * 0.3, cx + eyeSpan * 1.1);

  // Mũi
  lm[PT.NASION] = { x: cx, y: browY + 0.02 };
  lm[PT.NOSE_TIP] = { x: cx, y: noseBaseY - 0.02 };
  lm[PT.NOSE_BASE] = { x: cx, y: noseBaseY };
  lm[PT.ALA_RIGHT] = { x: cx - 0.045, y: noseBaseY };
  lm[PT.ALA_LEFT] = { x: cx + 0.045, y: noseBaseY };

  // Miệng
  const mouthY = noseBaseY + (chinY - noseBaseY) / 2;
  LIPS.forEach((id, i) => {
    const f = i / Math.max(1, LIPS.length - 1);
    lm[id] = { x: cx - mouthHalfW + f * 2 * mouthHalfW, y: mouthY };
  });
  lm[PT.MOUTH_R] = { x: cx - mouthHalfW, y: mouthY };
  lm[PT.MOUTH_L] = { x: cx + mouthHalfW, y: mouthY };
  lm[PT.LIP_UPPER_OUTER] = { x: cx, y: mouthY - 0.014 };
  lm[PT.LIP_UPPER_INNER] = { x: cx, y: mouthY - 0.002 };
  lm[PT.LIP_LOWER_INNER] = { x: cx, y: mouthY + 0.002 };
  lm[PT.LIP_LOWER_OUTER] = { x: cx, y: mouthY + 0.016 };

  return lm;
}

// --- Tam đình ---------------------------------------------------------------
describe("santing.balance", () => {
  it("bằng 1.0 khi ba tầng đều bằng 1/3", () => {
    const f = extractFeatures(synthFace());
    expect(f.santing.upper).toBeCloseTo(1 / 3, 6);
    expect(f.santing.middle).toBeCloseTo(1 / 3, 6);
    expect(f.santing.lower).toBeCloseTo(1 / 3, 6);
    expect(f.santing.balance).toBeCloseTo(1, 6);
    expect(f.santing.dominant).toBe("balanced");
  });

  it("ba tầng luôn cộng lại bằng 1", () => {
    const f = extractFeatures(synthFace({ browY: 0.3, noseBaseY: 0.55 }));
    expect(f.santing.upper + f.santing.middle + f.santing.lower).toBeCloseTo(1, 10);
  });

  it("giảm dần khi càng lệch", () => {
    const even = extractFeatures(synthFace()).santing.balance;
    const skewed = extractFeatures(synthFace({ browY: 0.28 })).santing.balance;
    const worse = extractFeatures(synthFace({ browY: 0.2 })).santing.balance;
    expect(even).toBeGreaterThan(skewed);
    expect(skewed).toBeGreaterThan(worse);
    expect(worse).toBeGreaterThanOrEqual(0);
  });

  it("nêu đúng tầng trội khi lệch hẳn", () => {
    // trán chiếm phần lớn => tầng trên trội
    const f = extractFeatures(synthFace({ browY: 0.6, noseBaseY: 0.72 }));
    expect(f.santing.dominant).toBe("upper");
  });
});

// --- Dạng miệng -------------------------------------------------------------
describe("classifyMouthShape", () => {
  it("trả đúng nhãn cho từng bộ giá trị biên", () => {
    expect(classifyMouthShape(0.65, 0.4, 0.1)).toBe("vong_cung");
    expect(classifyMouthShape(0.75, 0.55, 0.0)).toBe("ho");
    expect(classifyMouthShape(0.55, 0.5, 0.0)).toBe("long");
    expect(classifyMouthShape(0.4, 0.55, 0.0)).toBe("chu_tu");
    expect(classifyMouthShape(0.3, 0.2, 0.5)).toBe("khac");
  });

  it("thứ tự điều kiện: vòng cung được xét trước cọp", () => {
    // rộng > 0.7 nhưng môi mỏng + khoé hếch => vòng cung, không phải cọp
    expect(classifyMouthShape(0.72, 0.4, 0.1)).toBe("vong_cung");
  });

  it("chỉ trả các nhãn mà rules.json dùng, hoặc khac", () => {
    const allowed = new Set(["vong_cung", "ho", "long", "chu_tu", "khac"]);
    for (let w = 0; w <= 1; w += 0.1)
      for (let t = 0; t <= 1; t += 0.1)
        for (const c of [-0.2, 0, 0.2])
          expect(allowed.has(classifyMouthShape(w, t, c))).toBe(true);
  });
});

// --- Ngũ hình ---------------------------------------------------------------
describe("classifyFaceType", () => {
  const base = {
    faceW: 1,
    faceH: 1,
    jawW: 1,
    cheekW: 1,
    santingUpper: 1 / 3,
    santingLower: 1 / 3,
  };

  it("mặt vuông hàm rộng => kim", () => {
    expect(classifyFaceType({ ...base, faceW: 1, faceH: 1, jawW: 0.95 })).toBe("kim");
  });

  it("mặt dài thon => moc", () => {
    expect(classifyFaceType({ ...base, faceW: 0.75, faceH: 1, jawW: 0.5 })).toBe("moc");
  });

  it("trên thon dưới nở => hoa", () => {
    expect(
      classifyFaceType({
        ...base,
        faceW: 0.88,
        faceH: 1,
        jawW: 0.5,
        santingUpper: 0.28,
        santingLower: 0.4,
      })
    ).toBe("hoa");
  });

  it("tròn đầy => thuy", () => {
    expect(classifyFaceType({ ...base, faceW: 0.9, faceH: 1, jawW: 0.5 })).toBe("thuy");
  });

  it("còn lại => tho", () => {
    expect(classifyFaceType({ ...base, faceW: 0.83, faceH: 1, jawW: 0.5 })).toBe("tho");
  });

  it("luôn trả một trong năm hình", () => {
    const ok = new Set(["kim", "moc", "thuy", "hoa", "tho"]);
    for (let r = 0.6; r <= 1.3; r += 0.05)
      for (const jaw of [0.5, 0.85, 0.95])
        expect(ok.has(classifyFaceType({ ...base, faceW: r, faceH: 1, jawW: jaw }))).toBe(true);
  });
});

// --- Bất biến tỉ lệ ---------------------------------------------------------
describe("bất biến với kích thước ảnh", () => {
  it("phóng to toạ độ gấp đôi thì mọi đặc trưng không đổi", () => {
    const lm = synthFace({ browArc: 0.02, mouthHalfW: 0.1 });
    const scaled = lm.map((p) => ({ x: p.x * 2, y: p.y * 2 }));

    const a = extractFeatures(lm);
    const b = extractFeatures(scaled);

    expect(b.faceType).toBe(a.faceType);
    expect(b.mouth.shape).toBe(a.mouth.shape);
    for (const k of ["upper", "middle", "lower", "balance"] as const)
      expect(b.santing[k]).toBeCloseTo(a.santing[k], 10);
    for (const k of ["curvature", "length", "thickness", "eyeGap"] as const)
      expect(b.eyebrows[k]).toBeCloseTo(a.eyebrows[k], 10);
    for (const k of ["wingWidth", "bridgeWidth", "length"] as const)
      expect(b.nose[k]).toBeCloseTo(a.nose[k], 10);
    for (const k of ["width", "thickness", "cornerAngle"] as const)
      expect(b.mouth[k]).toBeCloseTo(a.mouth[k], 10);
  });

  it("tịnh tiến khuôn mặt cũng không đổi đặc trưng", () => {
    const lm = synthFace({ browArc: 0.02 });
    const moved = lm.map((p) => ({ x: p.x + 0.05, y: p.y - 0.03 }));
    const a = extractFeatures(lm);
    const b = extractFeatures(moved);
    expect(b.santing.balance).toBeCloseTo(a.santing.balance, 10);
    expect(b.mouth.width).toBeCloseTo(a.mouth.width, 10);
    expect(b.faceType).toBe(a.faceType);
  });
});

// --- Miền giá trị -----------------------------------------------------------
describe("miền giá trị và chất lượng", () => {
  it("các chỉ số 0..1 nằm trong khoảng, cornerAngle trong -1..1", () => {
    const f = extractFeatures(synthFace({ browArc: 0.03 }));
    const inUnit = [
      f.santing.balance,
      f.eyebrows.curvature,
      f.eyebrows.thickness,
      f.eyebrows.eyeGap,
      f.nose.wingWidth,
      f.nose.bridgeWidth,
      f.nose.length,
      f.mouth.width,
      f.mouth.thickness,
    ];
    for (const v of inUnit) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(f.mouth.cornerAngle).toBeGreaterThanOrEqual(-1);
    expect(f.mouth.cornerAngle).toBeLessThanOrEqual(1);
  });

  it("cung mày vồng thì curvature lớn hơn mày thẳng", () => {
    const flat = extractFeatures(synthFace({ browArc: 0 })).eyebrows.curvature;
    const arched = extractFeatures(synthFace({ browArc: 0.03 })).eyebrows.curvature;
    expect(arched).toBeGreaterThan(flat);
  });

  it("mặt thẳng đủ sáng thì đạt điều kiện chụp", () => {
    const f = extractFeatures(synthFace(), { brightness: 0.8 });
    expect(f.quality.landmarks).toBe(TOTAL_LANDMARKS);
    expect(Math.abs(f.quality.headTiltDeg)).toBeLessThan(1);
    expect(f.quality.ok).toBe(true);
  });

  it("thiếu sáng thì không đạt điều kiện chụp", () => {
    const f = extractFeatures(synthFace(), { brightness: 0.1 });
    expect(f.quality.ok).toBe(false);
  });

  it("đầu nghiêng quá ngưỡng thì không đạt", () => {
    const lm = synthFace();
    const rad = (20 * Math.PI) / 180;
    const rotated = lm.map((p) => ({
      x: 0.5 + (p.x - 0.5) * Math.cos(rad) - (p.y - 0.5) * Math.sin(rad),
      y: 0.5 + (p.x - 0.5) * Math.sin(rad) + (p.y - 0.5) * Math.cos(rad),
    }));
    const f = extractFeatures(rotated, { brightness: 0.9 });
    expect(Math.abs(f.quality.headTiltDeg)).toBeGreaterThan(8);
    expect(f.quality.ok).toBe(false);
  });
});
