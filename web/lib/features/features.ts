// Trích đặc trưng từ 478 điểm mốc — PIPELINE.md mục 4.
//
// Mọi kích thước chia cho khoảng cách hai khoé mắt ngoài (iod) hoặc cho bề
// ngang/cao mặt, nên kết quả bất biến với khoảng cách camera và độ phân giải.

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
import type {
  FaceFeatures,
  FaceType,
  ForeheadShape,
  Landmark,
  MouthShape,
} from "./types";

// --- Hiệu chỉnh (PIPELINE mục 10) -------------------------------------------
// Mỗi cặp [lo, hi] là dải người thật hợp lý của phép đo THÔ; giá trị được ép
// tuyến tính về 0..1. Chạy scripts/calibrate.ts trên 10-20 ảnh rồi chỉnh cho
// median rơi vào ~0.5. TRƯỚC KHI HIỆU CHỈNH, đừng tin con số % ở phiếu.
export const CALIB = {
  browCurvature: [0.02, 0.18] as [number, number], // sagitta / chord
  browThickness: [0.05, 0.16] as [number, number], // dày mày / iod
  browEyeGap: [0.08, 0.28] as [number, number], // (mí trên - mép dưới mày) / iod
  noseWingWidth: [0.25, 0.45] as [number, number], // bề ngang cánh mũi / bề ngang mặt
  noseBridgeWidth: [0.28, 0.46] as [number, number], // bề ngang sống mũi / iod
  noseLength: [0.5, 0.9] as [number, number], // dài mũi / iod
  mouthWidth: [0.35, 0.55] as [number, number], // bề ngang miệng / bề ngang mặt
  lipThickness: [0.12, 0.34] as [number, number], // (dày môi trên + dưới) / iod
  eyeSize: [0.07, 0.13] as [number, number], // cao mắt / iod
  foreheadWidth: [0.7, 0.92] as [number, number], // ngang trán / ngang mặt
  cheekbone: [1.0, 1.45] as [number, number], // ngang gò má / ngang hàm
};

/**
 * Bề ngang một mắt / iod ở người trung bình. iod đo hai khoé mắt NGOÀI nên bao
 * cả hai mắt lẫn khoảng giữa, một mắt chiếm khoảng 0.3 của nó. Dùng làm mốc để
 * eyes.length ≈ 1.0 với mắt trung bình — cùng quy ước với eyebrows.length.
 */
const EYE_LEN_REF = 0.3;

// Ngưỡng "đủ điều kiện chụp" của màn Scan (CLAUDE.md mục 11).
export const QUALITY_LIMITS = {
  minLandmarks: TOTAL_LANDMARKS,
  maxHeadTiltDeg: 8,
  minBrightness: 0.35,
};

// --- Tiện ích hình học ------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Ép tuyến tính x từ dải [lo, hi] về 0..1. */
export const norm = (x: number, lo: number, hi: number) =>
  hi === lo ? 0 : clamp01((x - lo) / (hi - lo));

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

const pick = (lm: Landmark[], ids: readonly number[]) => ids.map((i) => lm[i]);

const extent = (pts: Landmark[], axis: "x" | "y") => {
  const vs = pts.map((p) => p[axis]);
  return { min: Math.min(...vs), max: Math.max(...vs) };
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Khoảng cách vuông góc từ điểm p tới đường thẳng ab. */
const distToLine = (p: Landmark, a: Landmark, b: Landmark) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  return Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / len;
};

/**
 * Bề dày trung bình của một dải điểm (dùng cho lông mày).
 * Chia theo trục x thành nhiều khoang, mỗi khoang lấy chênh lệch y, rồi lấy
 * trung vị. Cách này không bị độ vòng của cung mày làm phồng số đo, và không
 * cần biết thứ tự điểm trên đường bao.
 */
const stripThickness = (pts: Landmark[], bins = 5) => {
  const { min, max } = extent(pts, "x");
  if (max === min) return 0;
  const widths: number[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = min + ((max - min) * i) / bins;
    const hi = min + ((max - min) * (i + 1)) / bins;
    const inBin = pts.filter(
      (p) => p.x >= lo && (i === bins - 1 ? p.x <= hi : p.x < hi)
    );
    if (inBin.length >= 2) {
      const e = extent(inBin, "y");
      widths.push(e.max - e.min);
    }
  }
  return widths.length ? median(widths) : 0;
};

/** Bề ngang của một chùm điểm; 0 nếu không đủ điểm để đo. */
const widthOf = (pts: Landmark[]) => {
  if (pts.length < 2) return 0;
  const e = extent(pts, "x");
  return e.max - e.min;
};

/** Hai đầu mút của một cung (điểm trái nhất và phải nhất). */
const endpoints = (pts: Landmark[]) => {
  let left = pts[0];
  let right = pts[0];
  for (const p of pts) {
    if (p.x < left.x) left = p;
    if (p.x > right.x) right = p;
  }
  return { left, right };
};

// --- Phân loại --------------------------------------------------------------

/** Ngũ hình — PIPELINE mục 4.2. */
export function classifyFaceType(input: {
  faceW: number;
  faceH: number;
  jawW: number;
  cheekW: number;
  santingUpper: number;
  santingLower: number;
}): FaceType {
  const r = input.faceW / input.faceH;
  const jaw = input.cheekW === 0 ? 0 : input.jawW / input.cheekW;
  // MVP: xấp xỉ "đầy thịt" bằng chính độ rộng tương đối của khuôn mặt.
  // Bản đầy đủ nên dùng thêm độ cong contour + độ đầy gò má.
  const fullness = norm(r, 0.75, 1.0);

  if (r >= 0.95 && jaw >= 0.9) return "kim";
  if (r <= 0.8) return "moc";
  if (input.santingUpper < input.santingLower - 0.04) return "hoa";
  if (fullness >= 0.6 && r >= 0.85) return "thuy";
  return "tho";
}

/**
 * Dạng trán, xấp xỉ từ độ thu hẹp của đường bao khi đi lên đỉnh trán.
 *
 * `taper` = ngang trán ở đỉnh / ngang trán ở ngang mày. Gần 1 nghĩa là hai bên
 * trán gần như song song → góc trán vuông; càng nhỏ thì hai góc càng bo tròn.
 *
 * CẢNH BÁO: tướng học phân loại trán theo CHÂN TÓC, mà FaceMesh không có điểm
 * mốc nào ở chân tóc — đường bao trên cùng của FACE_OVAL chỉ là mép trên vùng
 * da mặt. Vì vậy đây là xấp xỉ; hai ngưỡng dưới đây chưa hiệu chỉnh trên ảnh
 * thật (PIPELINE mục 10), đừng tin kết quả "vuong"/"goc_tron" trước bước đó.
 */
export function classifyForeheadShape(taper: number): ForeheadShape {
  if (taper >= 0.92) return "vuong";
  if (taper >= 0.78) return "goc_tron";
  return "khac";
}

/** Dạng miệng — PIPELINE mục 4.3 (giữ nguyên thứ tự điều kiện). */
export function classifyMouthShape(
  width: number,
  thickness: number,
  cornerAngle: number
): MouthShape {
  if (width > 0.62 && thickness < 0.45 && cornerAngle > 0.05) return "vong_cung";
  if (width > 0.7) return "ho";
  if (width >= 0.5 && width <= 0.65 && thickness >= 0.45 && thickness <= 0.6)
    return "long";
  if (Math.abs(cornerAngle) < 0.05 && thickness >= 0.5) return "chu_tu";
  return "khac";
}

// --- Hàm chính --------------------------------------------------------------

export type QualityInput = {
  /** 0..1. Phải do phía gọi đo từ khung hình; features.ts không thấy ảnh. */
  brightness?: number;
};

export function extractFeatures(
  lm: Landmark[],
  quality: QualityInput = {}
): FaceFeatures {
  const p = (i: number) => lm[i];

  // Mốc chuẩn hoá: khoảng cách hai khoé mắt ngoài.
  const iod = dist(p(PT.EYE_R_OUTER), p(PT.EYE_L_OUTER));

  const oval = pick(lm, FACE_OVAL);
  const ovalX = extent(oval, "x");
  const ovalY = extent(oval, "y");
  const faceW = ovalX.max - ovalX.min;
  const faceH = ovalY.max - ovalY.min;

  // --- Tam đình ---
  const brows = [...pick(lm, LEFT_EYEBROW), ...pick(lm, RIGHT_EYEBROW)];
  const browY = mean(brows.map((b) => b.y));
  const topY = p(PT.FOREHEAD_TOP).y;
  const chinY = p(PT.CHIN_BOTTOM).y;
  const noseBaseY = p(PT.NOSE_BASE).y;
  const totalH = chinY - topY;

  const upper = (browY - topY) / totalH;
  const middle = (noseBaseY - browY) / totalH;
  const lower = (chinY - noseBaseY) / totalH;
  const third = 1 / 3;
  const balance = clamp01(
    1 -
      Math.max(
        Math.abs(upper - third),
        Math.abs(middle - third),
        Math.abs(lower - third)
      ) /
        third
  );
  const parts = { upper, middle, lower };
  const dominantKey = (Object.keys(parts) as (keyof typeof parts)[]).reduce(
    (a, b) => (parts[a] >= parts[b] ? a : b)
  );

  // --- Cung mày (lấy trung bình hai bên) ---
  const browSides = [
    {
      brow: pick(lm, LEFT_EYEBROW),
      eye: pick(lm, LEFT_EYE),
      outer: PT.EYE_L_OUTER,
      inner: PT.EYE_L_INNER,
    },
    {
      brow: pick(lm, RIGHT_EYEBROW),
      eye: pick(lm, RIGHT_EYE),
      outer: PT.EYE_R_OUTER,
      inner: PT.EYE_R_INNER,
    },
  ];

  const curvRaw: number[] = [];
  const lenRatio: number[] = [];
  const thickRaw: number[] = [];
  const gapRaw: number[] = [];

  for (const s of browSides) {
    const { left, right } = endpoints(s.brow);
    const chord = dist(left, right);
    const sagitta = Math.max(...s.brow.map((pt) => distToLine(pt, left, right)));
    curvRaw.push(chord === 0 ? 0 : sagitta / chord);

    const eyeLen = dist(p(s.outer), p(s.inner));
    lenRatio.push(eyeLen === 0 ? 0 : chord / eyeLen);

    thickRaw.push(stripThickness(s.brow) / iod);

    const browBottom = extent(s.brow, "y").max;
    const eyeTop = extent(s.eye, "y").min;
    gapRaw.push((eyeTop - browBottom) / iod);
  }

  // --- Mắt ---
  // length: dài mắt so với mắt trung bình (>1 = mắt dài, kiểu mắt phượng).
  // size: độ mở của mắt theo chiều dọc — "mắt lớn" trong sách là mắt mở rộng,
  // lộ nhiều tròng, chứ không phải mắt dài; nên đo cao chứ không đo ngang.
  const eyeSides = [
    { pts: pick(lm, LEFT_EYE), outer: PT.EYE_L_OUTER, inner: PT.EYE_L_INNER },
    { pts: pick(lm, RIGHT_EYE), outer: PT.EYE_R_OUTER, inner: PT.EYE_R_INNER },
  ];
  const eyeLenRaw: number[] = [];
  const eyeHeightRaw: number[] = [];
  for (const s of eyeSides) {
    eyeLenRaw.push(dist(p(s.outer), p(s.inner)) / iod);
    const e = extent(s.pts, "y");
    eyeHeightRaw.push((e.max - e.min) / iod);
  }

  // --- Trán ---
  // Bề ngang đo ở ngang mày (chỗ rộng nhất của trán), so với bề ngang mặt.
  // Bề ngang một dải ngang của đường bao, tâm ở độ cao y, dày ±band.
  const bandWidth = (y: number, band: number) =>
    widthOf(oval.filter((pt) => Math.abs(pt.y - y) <= band));

  const foreheadW = bandWidth(browY - faceH * 0.06, faceH * 0.05);
  const foreheadTopW = bandWidth(ovalY.min + faceH * 0.1, faceH * 0.05);
  const foreheadTaper = foreheadW === 0 ? 0 : foreheadTopW / foreheadW;

  // --- Mũi ---
  const alaW = Math.abs(p(PT.ALA_LEFT).x - p(PT.ALA_RIGHT).x);
  // Bề ngang sống mũi: tạm dùng khoảng cách hai khoé mắt TRONG làm đại lượng
  // thay thế (sống mũi rộng thì hai khoé trong cũng xa nhau). Cần xác minh lại
  // bằng điểm mũi thật ở bước hiệu chỉnh — PIPELINE mục 10.
  const bridgeRaw = dist(p(PT.EYE_R_INNER), p(PT.EYE_L_INNER)) / iod;
  const noseLenRaw = (p(PT.NOSE_BASE).y - p(PT.NASION).y) / iod;

  // --- Miệng ---
  const lips = pick(lm, LIPS);
  const lipsX = extent(lips, "x");
  const mouthWRaw = lipsX.max - lipsX.min;
  const upperLip = p(PT.LIP_UPPER_INNER).y - p(PT.LIP_UPPER_OUTER).y;
  const lowerLip = p(PT.LIP_LOWER_OUTER).y - p(PT.LIP_LOWER_INNER).y;
  const lipThickRaw = (upperLip + lowerLip) / iod;

  const cornerY = (p(PT.MOUTH_R).y + p(PT.MOUTH_L).y) / 2;
  const centerY = (p(PT.LIP_UPPER_INNER).y + p(PT.LIP_LOWER_INNER).y) / 2;
  // y tăng xuống dưới, nên khoé cao hơn tâm môi => hiệu dương => hếch.
  const cornerAngle = Math.max(
    -1,
    Math.min(1, mouthWRaw === 0 ? 0 : (centerY - cornerY) / (mouthWRaw / 2))
  );

  const mouthWidth = norm(mouthWRaw / faceW, ...CALIB.mouthWidth);
  const lipThickness = norm(lipThickRaw, ...CALIB.lipThickness);

  // --- Hàm (cho phân loại ngũ hình) ---
  const jawPts = oval.filter((pt) => pt.y > ovalY.min + faceH * 0.7);
  const jawX = jawPts.length >= 2 ? extent(jawPts, "x") : ovalX;
  const jawW = jawX.max - jawX.min;

  // --- Gò má (lưỡng quyền) ---
  // "Quyền cao, nở rộng" là gò má nhô so với phần dưới khuôn mặt, nên lấy bề
  // ngang ở ngang gò má chia cho bề ngang hàm — chia cho faceW thì vô nghĩa vì
  // với phần lớn khuôn mặt, chỗ rộng nhất CHÍNH LÀ gò má nên tỉ số luôn ~1.
  // Gò má nằm hơi dưới khoé mắt ngoài.
  const eyeLineY = (p(PT.EYE_L_OUTER).y + p(PT.EYE_R_OUTER).y) / 2;
  const cheekW = bandWidth(eyeLineY + faceH * 0.06, faceH * 0.06);
  const cheekRaw = jawW === 0 ? 0 : cheekW / jawW;

  // --- Chất lượng khung hình ---
  const eyeDx = p(PT.EYE_L_OUTER).x - p(PT.EYE_R_OUTER).x;
  const eyeDy = p(PT.EYE_L_OUTER).y - p(PT.EYE_R_OUTER).y;
  const headTiltDeg = (Math.atan2(eyeDy, eyeDx) * 180) / Math.PI;
  const brightness = quality.brightness ?? 1;

  const santing = {
    upper,
    middle,
    lower,
    balance,
    dominant: (balance >= 0.85
      ? "balanced"
      : dominantKey) as FaceFeatures["santing"]["dominant"],
  };

  return {
    faceType: classifyFaceType({
      faceW,
      faceH,
      jawW,
      cheekW: faceW,
      santingUpper: upper,
      santingLower: lower,
    }),
    santing,
    forehead: {
      width: norm(foreheadW / faceW, ...CALIB.foreheadWidth),
      shape: classifyForeheadShape(foreheadTaper),
    },
    eyes: {
      length: mean(eyeLenRaw) / EYE_LEN_REF,
      size: norm(mean(eyeHeightRaw), ...CALIB.eyeSize),
    },
    cheekbone: {
      prominence: norm(cheekRaw, ...CALIB.cheekbone),
    },
    eyebrows: {
      curvature: norm(mean(curvRaw), ...CALIB.browCurvature),
      length: mean(lenRatio),
      thickness: norm(mean(thickRaw), ...CALIB.browThickness),
      eyeGap: norm(mean(gapRaw), ...CALIB.browEyeGap),
    },
    nose: {
      wingWidth: norm(alaW / faceW, ...CALIB.noseWingWidth),
      bridgeWidth: norm(bridgeRaw, ...CALIB.noseBridgeWidth),
      length: norm(noseLenRaw, ...CALIB.noseLength),
    },
    mouth: {
      width: mouthWidth,
      thickness: lipThickness,
      cornerAngle,
      shape: classifyMouthShape(mouthWidth, lipThickness, cornerAngle),
    },
    quality: {
      landmarks: lm.length,
      headTiltDeg,
      brightness,
      ok:
        lm.length >= QUALITY_LIMITS.minLandmarks &&
        Math.abs(headTiltDeg) <= QUALITY_LIMITS.maxHeadTiltDeg &&
        brightness >= QUALITY_LIMITS.minBrightness,
    },
  };
}
