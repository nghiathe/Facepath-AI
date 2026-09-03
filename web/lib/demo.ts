// Dữ liệu cho "Xem một phiếu mẫu" — CLAUDE.md mục 11 màn 01.
//
// Đây là chỗ DUY NHẤT được phép dùng số cố định (mục 13: "không hard-code trừ
// trang phiếu mẫu"). Vector dưới đây là một bộ chỉ số hợp lệ, còn archetype,
// luật khớp, trait và % nghề vẫn do engine tính ra thật từ nó — không phải số
// chép sẵn từ mockup.

import type { FaceFeatures } from "./features/types";
import type { ScanPayload } from "./session";

const DEMO_FEATURES: FaceFeatures = {
  faceType: "kim",
  santing: {
    upper: 0.37,
    middle: 0.32,
    lower: 0.31,
    balance: 0.88,
    dominant: "upper",
  },
  eyebrows: { curvature: 0.42, length: 1.05, thickness: 0.7, eyeGap: 0.55 },
  nose: { wingWidth: 0.55, bridgeWidth: 0.5, length: 0.52 },
  mouth: { width: 0.65, thickness: 0.5, cornerAngle: 0.1, shape: "vong_cung" },
  quality: { landmarks: 478, headTiltDeg: -2, brightness: 0.78, ok: true },
};

/** Phiếu mẫu: có chỉ số thật, không kèm ảnh (không dùng mặt người thật nào). */
export const DEMO_SCAN: ScanPayload = {
  features: DEMO_FEATURES,
  snapshot: null,
  landmarks: null,
  at: Date.parse("2026-09-03T00:00:00Z"),
};
