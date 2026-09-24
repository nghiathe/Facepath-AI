// Dữ liệu cho "Xem một phiếu mẫu" — CLAUDE.md mục 11 màn 01.
//
// Đây là chỗ DUY NHẤT được phép dùng số cố định (mục 13: "không hard-code trừ
// trang phiếu mẫu"). Vector dưới đây là một bộ chỉ số hợp lệ, còn archetype,
// luật khớp, trait và % nghề vẫn do engine tính ra thật từ nó — không phải số
// chép sẵn từ mockup.

import { FACE_TYPES } from "./data";
import { CALIB_IS_PROVISIONAL, classifyHanh, toZ } from "./features/shape";
import type { FaceFeatures, FaceType } from "./features/types";
import type { ScanPayload } from "./session";

/**
 * Bảy số đo dáng mặt của phiếu mẫu (features/shape.ts). Đây là số ĐO, còn hành
 * nào trội thì vẫn để classifyHanh tính ra — giữ đúng tinh thần ở đầu file:
 * phiếu mẫu cho sẵn vector, không cho sẵn kết luận.
 *
 * Bộ số này đặt quanh prototype của Kim trong face_types.json (trán và hàm
 * rộng gần bằng gò má, viền vuông, góc hàm nhỏ, mặt không dài).
 */
const DEMO_SHAPE_RAW = {
  fh: 0.859,
  temple: 0.925,
  jaw: 0.815,
  chin: 0.419,
  length: 1.128,
  round: 0.848,
  jaw_angle: 127.2,
};

const DEMO_SHAPE_Z = toZ(DEMO_SHAPE_RAW);
const DEMO_HANH = classifyHanh(
  DEMO_SHAPE_Z,
  FACE_TYPES.filter((f) => f.prototype).map((f) => ({
    key: f.key,
    prototype: f.prototype as Record<string, number>,
  }))
);

const DEMO_FEATURES: FaceFeatures = {
  faceType: DEMO_HANH.primary as FaceType,
  shape: {
    raw: DEMO_SHAPE_RAW,
    z: DEMO_SHAPE_Z,
    membership: DEMO_HANH.membership,
    secondary: DEMO_HANH.secondary as FaceType | null,
    label: DEMO_HANH.label,
    confident: DEMO_HANH.confident,
    measured: true,
    reason: null,
    calibProvisional: CALIB_IS_PROVISIONAL,
    usedModel: false,
    modelProbs: null,
  },
  santing: {
    upper: 0.37,
    middle: 0.32,
    lower: 0.31,
    balance: 0.88,
    dominant: "upper",
  },
  forehead: { width: 0.74, shape: "vuong" },
  eyes: { length: 1.04, size: 0.52 },
  // height/tailRise là SỐ THÔ (không ép 0..1) — xem ghi chú ở features/types.ts.
  cheekbone: { prominence: 0.63, height: 0.02 },
  eyebrows: {
    curvature: 0.42,
    length: 1.05,
    thickness: 0.7,
    eyeGap: 0.55,
    tailRise: 0.08,
  },
  nose: { wingWidth: 0.55, bridgeWidth: 0.5, length: 0.52 },
  mouth: { width: 0.65, thickness: 0.5, cornerAngle: 0.1, shape: "vong_cung" },
  quality: {
    landmarks: 478,
    headTiltDeg: -2,
    brightness: 0.78,
    yaw: 0.01,
    eyeSpanPx: 180,
    ok: true,
  },
};

/** Phiếu mẫu: có chỉ số thật, không kèm ảnh (không dùng mặt người thật nào). */
export const DEMO_SCAN: ScanPayload = {
  features: DEMO_FEATURES,
  snapshot: null,
  landmarks: null,
  at: Date.parse("2026-09-03T00:00:00Z"),
};
