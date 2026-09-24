// Hằng số nhóm điểm mốc — PIPELINE.md mục 4.
//
// Ưu tiên lấy nhóm có sẵn của MediaPipe thay vì gõ tay chỉ số. MediaPipe trả
// các nhóm dưới dạng Connection[] (cặp start/end), nên ở đây làm phẳng thành
// mảng chỉ số. Riêng MŨI không có nhóm sẵn nên phải khai báo tay ở một chỗ.

import { FaceLandmarker } from "@mediapipe/tasks-vision";

const flatten = (conns: { start: number; end: number }[]): number[] => {
  const s = new Set<number>();
  for (const c of conns) {
    s.add(c.start);
    s.add(c.end);
  }
  return [...s].sort((a, b) => a - b);
};

export const FACE_OVAL = flatten(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
export const LEFT_EYE = flatten(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE);
export const RIGHT_EYE = flatten(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE);
export const LEFT_EYEBROW = flatten(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW);
export const RIGHT_EYEBROW = flatten(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW);
export const LIPS = flatten(FaceLandmarker.FACE_LANDMARKS_LIPS);

/** Tổng số điểm của Face Landmarker (có iris). Dùng cho quality.landmarks. */
export const TOTAL_LANDMARKS = 478;

// --- Điểm đơn lẻ ------------------------------------------------------------
// MediaPipe không có nhóm cho mũi, và vài mốc dọc (đỉnh trán, cằm, khoé miệng)
// cần lấy đúng điểm chứ không phải cả nhóm. Đã đối chiếu với nhóm tương ứng:
// 10/152/234/454 thuộc FACE_OVAL, 33/133 thuộc RIGHT_EYE, 263/362 thuộc
// LEFT_EYE, 0/13/14/17/61/291 thuộc LIPS.
export const PT = {
  FOREHEAD_TOP: 10, // đỉnh trán (điểm trên cùng của oval)
  CHIN_BOTTOM: 152, // đáy cằm
  CHEEK_RIGHT: 234, // mép trái ảnh
  CHEEK_LEFT: 454, // mép phải ảnh

  EYE_R_OUTER: 33,
  EYE_R_INNER: 133,
  EYE_L_INNER: 362,
  EYE_L_OUTER: 263,

  NOSE_TIP: 1,
  NOSE_BASE: 2, // chân mũi (subnasale) — mốc chia tam đình giữa/dưới
  NASION: 168, // sống mũi trên, giữa hai mắt

  // Cánh mũi. Hai điểm này KHÔNG thuộc nhóm nào nên chưa đối chiếu được bằng
  // code — phải xác minh lại bằng mắt ở bước hiệu chỉnh (PIPELINE mục 10).
  ALA_RIGHT: 48,
  ALA_LEFT: 278,

  MOUTH_R: 61, // khoé miệng
  MOUTH_L: 291,
  LIP_UPPER_OUTER: 0,
  LIP_UPPER_INNER: 13,
  LIP_LOWER_INNER: 14,
  LIP_LOWER_OUTER: 17,
} as const;

/**
 * Đường viền mặt theo ĐÚNG THỨ TỰ đi vòng quanh contour.
 *
 * FACE_OVAL ở trên gom từ Connection[] rồi sort theo số, nên thứ tự điểm không
 * còn là thứ tự đi vòng. Đo bề ngang / bbox thì không sao, nhưng tính DIỆN TÍCH
 * đa giác (shape.ts: độ "đầy" của đường viền) thì sai hoàn toàn. Dãy dưới đây
 * chép từ data/lib/shapeClassifier.ts (bản tham chiếu của bộ dữ liệu v4).
 */
export const FACE_OVAL_ORDERED = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
] as const;

/**
 * Mốc dùng riêng cho phép đo dáng mặt v4 (data/README.md mục "Bản v4").
 * Tách khỏi PT để thấy rõ đây là bộ mốc của shape.ts, không phải của 4 lớp
 * bóc tách hiển thị trên phiếu.
 */
export const SHAPE_PT = {
  FOREHEAD_L: 54, // hai bên trán — lưới KHÔNG tới chân tóc, xem ghi chú shape.ts
  FOREHEAD_R: 284,
  TEMPLE_L: 21, // thái dương
  TEMPLE_R: 251,
  CHEEK_L: 234, // gò má (bizygomatic) — chỗ rộng nhất
  CHEEK_R: 454,
  JAW_L: 172, // góc hàm
  JAW_R: 397,
  CHIN_L: 149, // hai bên cằm
  CHIN_R: 378,
  MALAR_L: 117, // đỉnh gò má, để đo "quyền cao / thấp"
  MALAR_R: 346,
  BROW_HEAD_L: 55, // đầu mày (phía mũi)
  BROW_HEAD_R: 285,
  BROW_TAIL_L: 70, // đuôi mày (phía thái dương)
  BROW_TAIL_R: 300,
} as const;
