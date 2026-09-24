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
  // SỐ THÔ, không phải thang 0..1: ngưỡng 0 của luật cheekbone_high là ngưỡng
  // của chính sách (quyền so với trung điểm Sơn Căn – Chuẩn Đầu).
  cheekbone_height: (f) => f.cheekbone.height,
  brow_curvature: (f) => f.eyebrows.curvature,
  brow_length: (f) => f.eyebrows.length,
  brow_thickness: (f) => f.eyebrows.thickness,
  brow_eye_gap: (f) => f.eyebrows.eyeGap,
  // SỐ THÔ như cheekbone_height — luật brow_kiem so đuôi mày với 0.12.
  brow_tail_rise: (f) => f.eyebrows.tailRise,
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

/**
 * feature_key của các luật GHÉP (op="all").
 *
 * Chúng không có accessor riêng: giá trị được suy từ các vế trong
 * `rule.conditions`, mà mỗi vế lại trỏ vào một key có trong NUMERIC. Liệt kê ở
 * đây để danh mục hiển thị (features/catalog.ts) và test "không có nhãn thừa"
 * vẫn coi chúng là key hợp lệ.
 */
export const COMPOSITE_KEYS: Record<string, string> = {
  brow_kiem: "Mày lưỡi kiếm (dài + thẳng + ngược đuôi)",
};

/** Mọi feature_key mà engine hiểu được. */
export const SUPPORTED_KEYS = [
  ...Object.keys(NUMERIC),
  ...Object.keys(CATEGORICAL),
  ...Object.keys(COMPOSITE_KEYS),
].sort();

/**
 * Những feature_key mà một luật THẬT SỰ đọc giá trị.
 *
 * Luật thường đọc chính `feature_key` của nó. Luật ghép (op="all") thì không:
 * `feature_key` của nó chỉ là tên gọi của cái tướng ("brow_kiem"), còn giá trị
 * nằm ở các vế trong `conditions`. Phân biệt hai thứ này để test "mọi chỉ số
 * đều đọc được" và "không accessor nào thừa" hỏi đúng câu hỏi.
 */
export const readKeys = (r: {
  feature_key: string;
  conditions?: { feature_key: string }[];
}): string[] =>
  r.conditions?.length ? r.conditions.map((c) => c.feature_key) : [r.feature_key];

/**
 * Tìm feature_key có trong rules nhưng thiếu accessor.
 * Dùng trong test để dữ liệu và code không lệch nhau lúc nào không hay.
 */
export function missingAccessors(featureKeys: readonly string[]): string[] {
  const known = new Set(SUPPORTED_KEYS);
  return [...new Set(featureKeys)].filter((k) => !known.has(k)).sort();
}
