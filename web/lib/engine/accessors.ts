// Ánh xạ feature_key (phẳng, như trong rules.json) sang giá trị trong
// FaceFeatures (lồng nhau) — PIPELINE.md mục 3.
//
// Nhờ lớp này, rule-engine không cần biết cấu trúc lồng nhau của FaceFeatures.
// Thêm feature_key mới vào rules.json thì phải thêm accessor tương ứng ở đây,
// nếu không luật sẽ bị bỏ qua (rule-engine không ném lỗi, xem checkCoverage).

import type { FaceFeatures } from "../features/types";

export const NUMERIC: Record<string, (f: FaceFeatures) => number> = {
  santing_upper: (f) => f.santing.upper,
  santing_lower: (f) => f.santing.lower,
  santing_balance: (f) => f.santing.balance,
  forehead_width: (f) => f.forehead.width,
  eye_length: (f) => f.eyes.length,
  eye_size: (f) => f.eyes.size,
  cheekbone_prominence: (f) => f.cheekbone.prominence,
  brow_curvature: (f) => f.eyebrows.curvature,
  brow_length: (f) => f.eyebrows.length,
  brow_thickness: (f) => f.eyebrows.thickness,
  brow_eye_gap: (f) => f.eyebrows.eyeGap,
  nose_wing_width: (f) => f.nose.wingWidth,
  nose_bridge_width: (f) => f.nose.bridgeWidth,
  mouth_corner_angle: (f) => f.mouth.cornerAngle,
  mouth_width: (f) => f.mouth.width,
  lip_thickness: (f) => f.mouth.thickness,
};

export const CATEGORICAL: Record<string, (f: FaceFeatures) => string> = {
  face_shape: (f) => f.faceType,
  mouth_shape: (f) => f.mouth.shape,
  forehead_shape: (f) => f.forehead.shape,
};

/** Mọi feature_key mà engine hiểu được. */
export const SUPPORTED_KEYS = [
  ...Object.keys(NUMERIC),
  ...Object.keys(CATEGORICAL),
].sort();

/**
 * Tìm feature_key có trong rules nhưng thiếu accessor.
 * Dùng trong test để dữ liệu và code không lệch nhau lúc nào không hay.
 */
export function missingAccessors(featureKeys: readonly string[]): string[] {
  const known = new Set(SUPPORTED_KEYS);
  return [...new Set(featureKeys)].filter((k) => !known.has(k)).sort();
}
