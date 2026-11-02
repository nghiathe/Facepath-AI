// Đo các bộ vị mới của bản dữ liệu v6: ấn đường, sơn căn, chuẩn đầu, nhân trung,
// khoảng cách mắt, tròng mắt, cằm (data/README.md, mục "Bản v6").
//
// Tách khỏi features.ts vì hai lẽ: mọi phép đo ở đây chạy trên toạ độ PIXEL đã
// khử nghiêng đầu (như shape.ts), và cần thêm trục z.
//
// Thang đo: `norm` theo BOVI_CALIB, mép dải là khoảng ±1,5 độ lệch quanh khuôn
// mặt trung bình của MediaPipe, nên mặt trung bình rơi vào ~0.5. Đây là số TẠM,
// giống CALIB ở features.ts: chưa hiệu chỉnh trên người thật thì đừng tin các
// ngưỡng trong rules.json (PIPELINE.md mục 10).
//
// GIỚI HẠN CỦA PHÉP ĐO — phiếu không được nói quá những gì đo được:
// - Trục z của FaceMesh là ước lượng từ một ảnh 2D, không phải độ sâu thật.
//   nasion_height, nose_tip_height, eye_depth nhiễu hơn các số đo trên mặt phẳng.
// - Lưới mặt được làm trơn nên các số "độ ngay" (nose_straightness,
//   philtrum_straightness) chủ yếu phản ánh độ lệch lớn; vằn, nếp, độ sâu của
//   nhân trung thì không đo được.
// - philtrum_taper dùng chân mũi và đỉnh môi trên làm mốc thay thế, vì lưới
//   không có điểm nào nằm đúng trên hai gờ nhân trung.

import { deRoll, type ShapeExtra, type ShapeRaw } from "./shape";
import { NOSE_BRIDGE_LINE, PT, BOVI_PT as B } from "./landmark-ids";
import type { Landmark } from "./types";

/** Các feature_key mới, dùng làm tên trường của FaceFeatures.bovi. */
export const BOVI_KEYS = [
  "glabella_width",
  "nasion_height",
  "nose_length",
  "nose_ridge_width",
  "nose_tip_height",
  "nose_tip_size",
  "nose_straightness",
  "philtrum_length",
  "philtrum_straightness",
  "philtrum_taper",
  "eye_spacing",
  "eye_tilt",
  "eye_depth",
  "iris_ratio",
  "chin_width",
  "chin_length",
  "jaw_width",
  "face_length",
  "face_round",
  "mouth_level",
  "lip_balance",
] as const;

export type BoViKey = (typeof BOVI_KEYS)[number];
export type BoVi = Record<BoViKey, number>;

/** Dải [lo, hi] của phép đo thô. Số tạm — xem ghi chú đầu file. */
export const BOVI_CALIB = {
  glabella_width: [0.2, 0.35], // hai đầu mày / iod
  nasion_height: [0.08, 0.25], // sơn căn nhô hơn khoé mắt trong / iod
  nose_length: [0.42, 0.78], // sơn căn tới chân mũi / iod
  nose_ridge_width: [0.08, 0.18], // bề ngang sống mũi / iod
  nose_tip_height: [0.2, 0.4], // đầu mũi nhô hơn chân cánh mũi / iod
  nose_tip_size: [0.22, 0.4], // bề ngang đầu mũi / bề ngang cánh mũi
  philtrum_length: [0.1, 0.2], // chân mũi tới môi trên / iod
  philtrum_taper: [1.0, 1.4], // rộng ở đỉnh môi / rộng ở chân mũi
  eye_spacing: [1.2, 1.7], // hai khoé mắt trong / bề ngang một mắt
  eye_depth: [0.02, 0.11], // mí trên lùi sau gờ mày / iod
  iris_ratio: [0.33, 0.45], // đường kính tròng / bề ngang mắt
  chin_width: [0.345, 0.495], // ngang cằm / ngang gò má
  chin_length: [0.35, 0.56], // môi dưới tới đáy cằm / iod
  jaw_width: [0.7, 0.85], // ngang hàm / ngang gò má
  face_length: [1.03, 1.27], // dài mặt / ngang gò má
  face_round: [0.8, 0.865], // diện tích viền / khung bao
} as const;

/** Trên mức lệch này thì độ ngay về 0. */
const MAX_NOSE_DEV = 0.08; // so với dài mũi
const MAX_PHILTRUM_DEV = 0.25; // so với dài nhân trung
const MAX_MOUTH_TILT = 0.05; // so với rộng miệng
const MAX_LIP_DIFF = 0.5; // chênh dày hai môi / tổng dày

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const norm = (x: number, [lo, hi]: readonly [number, number]) =>
  clamp01((x - lo) / (hi - lo));
const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
const ratio = (a: number, b: number) => (b > 0 ? a / b : NaN);

/** Độ lệch khỏi đường thẳng ab, tính theo trục ngang của mặt. */
const offLine = (p: Landmark, a: Landmark, b: Landmark) => {
  const t = b.y === a.y ? 0 : (p.y - a.y) / (b.y - a.y);
  return Math.abs(p.x - (a.x + t * (b.x - a.x)));
};

/**
 * @param lmPx  điểm mốc đã đổi sang pixel bằng toPixels()
 * @param frameWidth  bề ngang khung, để đổi z về cùng đơn vị pixel: z của
 *   MediaPipe có thang gần với x đã chuẩn hoá, mà toPixels() giữ nguyên z.
 * @param shape, extra  kết quả measureShape(), dùng lại thay vì đo hai lần
 */
export function measureBoVi(
  lmPx: Landmark[],
  frameWidth: number,
  shape: ShapeRaw,
  extra: ShapeExtra
): BoVi {
  const lm = deRoll(lmPx);
  const z = (i: number) => (lm[i].z ?? NaN) * frameWidth;
  const iod = dist(lm[PT.EYE_R_OUTER], lm[PT.EYE_L_OUTER]);
  const eyeW =
    (dist(lm[PT.EYE_R_OUTER], lm[PT.EYE_R_INNER]) +
      dist(lm[PT.EYE_L_OUTER], lm[PT.EYE_L_INNER])) /
    2;
  const r = (a: number) => ratio(a, iod);

  // Sơn căn, mũi
  const noseLen = dist(lm[PT.NASION], lm[PT.NOSE_BASE]);
  const alaW = dist(lm[PT.ALA_RIGHT], lm[PT.ALA_LEFT]);
  const noseDev = Math.max(
    ...NOSE_BRIDGE_LINE.map((i) => offLine(lm[i], lm[PT.NASION], lm[PT.NOSE_BASE]))
  );
  const innerEyeZ = (z(PT.EYE_R_INNER) + z(PT.EYE_L_INNER)) / 2;
  const alaBaseZ = (z(B.ALA_BASE_R) + z(B.ALA_BASE_L)) / 2;

  // Nhân trung
  const philtrumLen = lm[PT.LIP_UPPER_OUTER].y - lm[PT.NOSE_BASE].y;
  const philtrumDev =
    Math.abs(lm[PT.LIP_UPPER_OUTER].x - lm[PT.NOSE_BASE].x) +
    offLine(lm[B.PHILTRUM_MID], lm[PT.NOSE_BASE], lm[PT.LIP_UPPER_OUTER]);

  // Mắt
  const ridgeZ = (z(B.BROW_RIDGE_R) + z(B.BROW_RIDGE_L)) / 2;
  const lidZ = (z(B.LID_TOP_R) + z(B.LID_TOP_L)) / 2;
  // Lấy trung bình cả hai đường kính, ngang và dọc, của cả hai mắt.
  const irisDiam = ([a, b, c, d]: readonly number[]) =>
    (dist(lm[a], lm[c]) + dist(lm[b], lm[d])) / 2;
  const iris = (irisDiam(B.IRIS_R) + irisDiam(B.IRIS_L)) / 2;

  // Miệng
  const mouthW = dist(lm[PT.MOUTH_R], lm[PT.MOUTH_L]);
  const upperLip = lm[PT.LIP_UPPER_INNER].y - lm[PT.LIP_UPPER_OUTER].y;
  const lowerLip = lm[PT.LIP_LOWER_OUTER].y - lm[PT.LIP_LOWER_INNER].y;

  const c = BOVI_CALIB;
  return {
    glabella_width: norm(r(dist(lm[B.BROW_INNER_R], lm[B.BROW_INNER_L])), c.glabella_width),
    nasion_height: norm(r(innerEyeZ - z(PT.NASION)), c.nasion_height),
    nose_length: norm(r(noseLen), c.nose_length),
    nose_ridge_width: norm(r(dist(lm[B.NOSE_RIDGE_R], lm[B.NOSE_RIDGE_L])), c.nose_ridge_width),
    nose_tip_height: norm(r(alaBaseZ - z(B.NOSE_TIP_TOP)), c.nose_tip_height),
    nose_tip_size: norm(ratio(dist(lm[B.TIP_SIDE_R], lm[B.TIP_SIDE_L]), alaW), c.nose_tip_size),
    nose_straightness: 1 - clamp01(ratio(noseDev, noseLen) / MAX_NOSE_DEV),
    philtrum_length: norm(r(philtrumLen), c.philtrum_length),
    philtrum_straightness: 1 - clamp01(ratio(philtrumDev, philtrumLen) / MAX_PHILTRUM_DEV),
    philtrum_taper: norm(
      ratio(dist(lm[B.CUPID_R], lm[B.CUPID_L]), dist(lm[B.NOSTRIL_IN_R], lm[B.NOSTRIL_IN_L])),
      c.philtrum_taper
    ),
    eye_spacing: norm(ratio(dist(lm[PT.EYE_R_INNER], lm[PT.EYE_L_INNER]), eyeW), c.eye_spacing),
    // SỐ THÔ: luật so với mean/std của eye_tilt trong calib_shape.json.
    eye_tilt: extra.eye_tilt,
    eye_depth: norm(r(lidZ - ridgeZ), c.eye_depth),
    iris_ratio: norm(ratio(iris, eyeW), c.iris_ratio),
    chin_width: norm(shape.chin, c.chin_width),
    chin_length: norm(r(lm[PT.CHIN_BOTTOM].y - lm[PT.LIP_LOWER_OUTER].y), c.chin_length),
    jaw_width: norm(shape.jaw, c.jaw_width),
    face_length: norm(shape.length, c.face_length),
    face_round: norm(shape.round, c.face_round),
    mouth_level:
      1 - clamp01(ratio(Math.abs(lm[PT.MOUTH_R].y - lm[PT.MOUTH_L].y), mouthW) / MAX_MOUTH_TILT),
    lip_balance:
      1 - clamp01(ratio(Math.abs(upperLip - lowerLip), upperLip + lowerLip) / MAX_LIP_DIFF),
  };
}
