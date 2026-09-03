// Schema đặc trưng khuôn mặt — PIPELINE.md mục 2.
// Tên trường ánh xạ 1-1 sang feature_key trong data/rules.json (xem accessors.ts).

/** Ngũ hình. Khớp cột `key` trong data/face_types.json và category của face_shape. */
export type FaceType = "kim" | "moc" | "thuy" | "hoa" | "tho";

/** Dạng miệng. 4 giá trị đầu được rules.json dùng; "khac" là nhánh mặc định. */
export type MouthShape = "vong_cung" | "ho" | "long" | "chu_tu" | "khac";

/** Một điểm mốc đã chuẩn hoá về [0,1] theo khung hình (định dạng MediaPipe). */
export type Landmark = { x: number; y: number; z?: number };

export type FaceFeatures = {
  faceType: FaceType; // → feature_key face_shape

  santing: {
    upper: number; // 0..1, phần trán / tổng cao mặt
    middle: number; // 0..1 (tính để hiển thị, rules chưa dùng)
    lower: number; // 0..1, phần cằm
    balance: number; // 0..1, 1 = cân (33/34/33)
    dominant: "upper" | "middle" | "lower" | "balanced"; // chỉ để hiển thị
  };

  eyebrows: {
    curvature: number; // 0..1, 0 = thẳng      → brow_curvature
    length: number; // tỉ số so với mắt, 1.0 = bằng mắt → brow_length
    thickness: number; // 0..1                 → brow_thickness
    eyeGap: number; // 0..1                    → brow_eye_gap
  };

  nose: {
    wingWidth: number; // 0..1                 → nose_wing_width
    bridgeWidth: number; // 0..1               → nose_bridge_width
    length: number; // 0..1 (dự phòng, rules chưa dùng)
  };

  mouth: {
    width: number; // 0..1                     → mouth_width
    thickness: number; // 0..1, độ dày môi     → lip_thickness
    cornerAngle: number; // -1..1, dương = hếch → mouth_corner_angle
    shape: MouthShape; // → mouth_shape
  };

  quality: {
    // để màn Scan quyết định "đủ điều kiện chụp"
    landmarks: number; // số điểm nhận được / 478
    headTiltDeg: number;
    brightness: number; // 0..1
    ok: boolean;
  };
};
