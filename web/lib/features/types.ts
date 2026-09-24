// Schema đặc trưng khuôn mặt — PIPELINE.md mục 2.
// Tên trường ánh xạ 1-1 sang feature_key trong data/rules.json (xem accessors.ts).

/** Ngũ hình. Khớp cột `key` trong data/data-train/face_types.json và category của face_shape. */
export type FaceType = "kim" | "moc" | "thuy" | "hoa" | "tho";

/** Dạng miệng. 4 giá trị đầu được rules.json dùng; "khac" là nhánh mặc định. */
export type MouthShape = "vong_cung" | "ho" | "long" | "chu_tu" | "khac";

/**
 * Dạng trán. rules.json dùng "vuong" và "goc_tron"; "khac" là nhánh mặc định.
 * Tướng học phân loại theo chân tóc, mà FaceMesh không thấy chân tóc — nên đây
 * là XẤP XỈ từ đường bao trán (rules.json đã ghi chú `requires` đúng điều này).
 */
export type ForeheadShape = "vuong" | "goc_tron" | "khac";

/** Một điểm mốc đã chuẩn hoá về [0,1] theo khung hình (định dạng MediaPipe). */
export type Landmark = { x: number; y: number; z?: number };

export type FaceFeatures = {
  faceType: FaceType; // → feature_key face_shape

  /**
   * Chi tiết của phép phân loại dáng mặt v4 (features/shape.ts).
   * `faceType` ở trên chính là `shape.primary`, giữ lại vì rule-engine và toàn
   * bộ phiếu đã dùng tên đó.
   */
  shape: {
    /** Bảy số đo thô: fh / temple / jaw / chin / length / round / jaw_angle. */
    raw: Record<string, number>;
    /** Cùng các chiều đó nhưng đã quy về z-score theo calib_shape.json. */
    z: Record<string, number>;
    /** Xác suất từng hành, đã sắp giảm dần. */
    membership: { key: string; p: number }[];
    /** Hành kiêm, null nếu một hành trội rõ. */
    secondary: FaceType | null;
    /** vd "Kim" hoặc "Kim kiêm Thổ". */
    label: string;
    /** false = không hành nào trội rõ; phiếu phải nói ra điều đó. */
    confident: boolean;
    /**
     * false khi không đo được dáng mặt (mặt quay ngang, hoặc chụp quá xa).
     * Lúc đó faceType là giá trị dự phòng, KHÔNG được trình bày như kết quả.
     */
    measured: boolean;
    /** Vì sao không đo được, nếu measured = false. */
    reason: "yaw" | "too_small" | null;
    /**
     * true khi calib_shape.json vẫn là số tạm (chưa chạy tools/calibrate.py
     * trên dữ liệu thật) — z-score khi đó chỉ là ước lượng.
     */
    calibProvisional: boolean;
    /**
     * true khi `membership` đã được trộn thêm xác suất của model faceshape
     * (features/model.ts). Model KHÔNG phải nguồn tướng học, nên phiếu phải
     * ghi nguồn riêng cho nó — xem data/README.md.
     */
    usedModel: boolean;
    /**
     * Xác suất thô của model theo thứ tự Heart, Oblong, Oval, Round, Square;
     * null khi không chạy model. Giữ lại để tra cứu và để báo cáo đồ án.
     */
    modelProbs: number[] | null;
  };

  santing: {
    upper: number; // 0..1, phần trán / tổng cao mặt
    middle: number; // 0..1 (tính để hiển thị, rules chưa dùng)
    lower: number; // 0..1, phần cằm
    balance: number; // 0..1, 1 = cân (33/34/33)
    dominant: "upper" | "middle" | "lower" | "balanced"; // chỉ để hiển thị
  };

  forehead: {
    width: number; // 0..1                     → forehead_width
    shape: ForeheadShape; //                   → forehead_shape
  };

  eyes: {
    length: number; // tỉ số, 1.0 = mắt dài trung bình → eye_length
    size: number; // 0..1, độ mở của mắt       → eye_size
  };

  cheekbone: {
    prominence: number; // 0..1                → cheekbone_prominence
    /**
     * Độ cao của lưỡng quyền so với trung điểm Sơn Căn – Chuẩn Đầu, dương =
     * "quyền cao". SỐ THÔ, không ép về 0..1: ngưỡng 0 trong luật cheekbone_high
     * là ngưỡng của chính sách, so trực tiếp với phép đo này.
     */
    height: number; //                         → cheekbone_height
  };

  eyebrows: {
    curvature: number; // 0..1, 0 = thẳng      → brow_curvature
    length: number; // tỉ số so với mắt, 1.0 = bằng mắt → brow_length
    thickness: number; // 0..1                 → brow_thickness
    eyeGap: number; // 0..1                    → brow_eye_gap
    /**
     * Đuôi mày cao hơn đầu mày bao nhiêu (chia cho bề ngang mắt); dương = đuôi
     * ngược lên. SỐ THÔ như cheekbone.height — luật brow_kiem so với 0.12.
     */
    tailRise: number; //                       → brow_tail_rise
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
    /** Độ quay ngang của đầu; |yaw| > YAW_LIMIT thì không đo được dáng mặt. */
    yaw: number;
    /** Khoảng cách hai khoé mắt ngoài, px — chụp quá xa thì nhiễu lấn át. */
    eyeSpanPx: number;
    ok: boolean;
  };
};
