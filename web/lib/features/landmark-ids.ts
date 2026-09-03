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
