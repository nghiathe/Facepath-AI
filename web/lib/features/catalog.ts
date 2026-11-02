// Danh mục chỉ số khuôn mặt cho phía trình duyệt — bản đối chiếu của
// api/rules/features.py (FEATURE_LAYERS / FEATURE_LABELS).
//
// VÌ SAO CHÉP LẠI THAY VÌ GỌI /api/features: trang "Khám phá" tra cứu chính bộ
// luật mà engine đang chạy (data/data-train/rules.json đã nằm sẵn trong bundle qua
// lib/data.ts). Bắt trang tra cứu phụ thuộc MySQL + FastAPI đang bật thì lúc
// bảo vệ đồ án chỉ cần backend chưa chạy là cả tab trống trơn.
//
// Nguồn sự thật vẫn là data/data-train/rules.json. catalog.test.ts kiểm tra:
// mọi feature_key trong rules.json đều có nhãn ở đây, và không có nhãn thừa.

import { FACE_TYPES } from "../data";

/** 4 lớp bóc tách, đúng thứ tự hiển thị trên phiếu (CLAUDE.md mục 7). */
export const FEATURE_LAYERS: { layer: string; keys: Record<string, string> }[] = [
  {
    layer: "Lớp 1 — Dáng mặt & tam đình",
    keys: {
      face_shape: "Ngũ hình (kim/mộc/thuỷ/hoả/thổ)",
      santing_upper: "Tam đình — thượng đình (trí lực)",
      santing_lower: "Tam đình — hạ đình (hoạt lực)",
      santing_balance: "Tam đình cân đối (1 = cân)",
      forehead_width: "Bề ngang trán",
      forehead_shape: "Dạng trán (vuông / góc tròn) — xấp xỉ",
      cheekbone_prominence: "Lưỡng quyền (gò má) nở",
      cheekbone_height: "Lưỡng quyền cao / thấp (0 = ngang sống mũi)",
      chin_width: "Bề ngang cằm",
      chin_length: "Chiều dài cằm",
      jaw_width: "Bề ngang hàm",
      face_length: "Độ dài khuôn mặt",
      face_round: "Độ tròn đầy của đường viền mặt",
      chin_brow_square: "Cằm và trán vuông đều (luật ghép)",
      chin_full_open: "Cằm và hàm đầy đặn (luật ghép)",
      chin_long_narrow: "Cằm dài, thon (luật ghép)",
      face_round_gentle: "Mặt rộng, tròn (luật ghép)",
      forehead_brow_literary: "Trán rộng, mày thanh (luật ghép)",
    },
  },
  {
    // Mắt gộp vào lớp cung mày thay vì mở lớp thứ 5, để overlay màn 04 vẫn
    // đúng 4 lớp như mockup — xem ghi chú ở api/rules/features.py.
    layer: "Lớp 2 — Cung mày & mắt",
    keys: {
      brow_curvature: "Độ cong cung mày (0 = thẳng)",
      brow_length: "Chiều dài cung mày (1.0 = bằng mắt)",
      brow_thickness: "Độ đậm cung mày",
      brow_eye_gap: "Khoảng cách mày — mắt",
      eye_length: "Chiều dài mắt (1.0 = trung bình)",
      eye_size: "Độ mở của mắt",
      brow_tail_rise: "Đuôi mày ngược lên (0 = ngang)",
      brow_kiem: "Mày lưỡi kiếm (dài + thẳng + ngược đuôi)",
      glabella_width: "Ấn đường — khoảng giữa hai đầu mày",
      eye_spacing: "Khoảng cách hai mắt",
      eye_tilt: "Đuôi mắt xếch (âm = rủ)",
      eye_depth: "Độ sâu của mắt — xấp xỉ",
      iris_ratio: "Tỉ lệ tròng đen so với mắt",
      eye_brow_open_space: "Vùng giữa hai mắt, hai mày thoáng rộng (luật ghép)",
      eye_lion: "Mắt lớn, mày đậm (luật ghép)",
      eye_long_brow_clear: "Mắt nhỏ dài, mày thanh (luật ghép)",
      eye_fine_gentle: "Mắt nhỏ, dài (luật ghép)",
      eye_deep_fine: "Mắt nhỏ, sâu (luật ghép)",
      iris_mouth_literary: "Tròng đen lớn, miệng rộng (luật ghép)",
      eye_tail_down: "Đuôi mắt rủ, thượng đình dài (luật ghép)",
      brow_fine_arched: "Mày mảnh, cong (luật ghép)",
      brow_fine_long: "Mày mảnh, phẳng, dài (luật ghép)",
      brow_straight_head_up: "Mày thẳng, đầu mày cao (luật ghép)",
      brow_high_arch: "Mày cong cao như trăng non (luật ghép)",
      brow_clear_fair: "Mày thanh, phẳng (luật ghép)",
      brow_willow: "Mày lá liễu (luật ghép)",
      brow_thick_eye_firm: "Mày đậm, mắt to (luật ghép)",
    },
  },
  {
    layer: "Lớp 3 — Mũi & nhân trung",
    keys: {
      nose_wing_width: "Bề rộng cánh mũi",
      nose_bridge_width: "Bề rộng sống mũi",
      nasion_height: "Sơn căn cao / thấp — xấp xỉ",
      nose_length: "Chiều dài mũi",
      nose_ridge_width: "Bề ngang sống mũi ở sơn căn",
      nose_tip_height: "Chuẩn đầu cao — xấp xỉ",
      nose_tip_size: "Chuẩn đầu đầy đặn",
      nose_straightness: "Sống mũi ngay (1 = thẳng)",
      philtrum_length: "Nhân trung dài",
      philtrum_straightness: "Nhân trung ngay (1 = thẳng)",
      philtrum_taper: "Nhân trung trên hẹp dưới rộng — xấp xỉ",
      nasion_straight_loyal: "Sống mũi thẳng liền tới sơn căn (luật ghép)",
      nose_wide_long: "Mũi rộng và dài (luật ghép)",
      nose_high_narrow: "Sống mũi cao, thon (luật ghép)",
      nose_round_straight: "Mũi thẳng, đầu mũi tròn đầy (luật ghép)",
      nose_deer: "Mũi đầy, đầu mũi tròn (luật ghép)",
      nose_high_round: "Sống mũi cao, đầu mũi tròn (luật ghép)",
      nose_leopard: "Mặt dài, mũi cao (luật ghép)",
      philtrum_clear: "Nhân trung dài, rõ (luật ghép)",
    },
  },
  {
    layer: "Lớp 4 — Miệng & môi",
    keys: {
      mouth_width: "Khoé miệng ngang",
      lip_thickness: "Độ dày môi",
      mouth_corner_angle: "Góc khoé miệng (âm = cụp)",
      mouth_shape: "Dạng miệng (vòng cung / cọp / rồng / chữ tứ)",
      mouth_level: "Miệng ngay ngắn (1 = hai khoé ngang)",
      lip_balance: "Hai môi tương xứng (1 = bằng nhau)",
      mouth_square_speech: "Miệng vuông vắn (luật ghép)",
      lips_wide_even: "Môi rộng, ngay ngắn (luật ghép)",
    },
  },
];

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(
  FEATURE_LAYERS.flatMap((l) => Object.entries(l.keys))
);

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

/** Nhãn của một feature_key; trả lại chính key nếu thiếu, để lỗi lộ ra. */
export const featureLabel = (key: string): string => FEATURE_LABELS[key] ?? key;

/** Lớp chứa feature_key đó, vd "Lớp 3 — Mũi". */
export const featureLayer = (key: string): string =>
  FEATURE_LAYERS.find((l) => key in l.keys)?.layer ?? "Khác";

// Giá trị phân loại -> chữ tiếng Việt. Ngũ hình lấy thẳng từ face_types.json
// để không phải chép nhãn ở hai nơi.
const FACE_TYPE_LABELS = Object.fromEntries(
  FACE_TYPES.map((f) => [f.key, f.label])
);

const OTHER_CATEGORY_LABELS: Record<string, string> = {
  vong_cung: "miệng vòng cung",
  ho: "miệng cọp",
  long: "miệng rồng",
  chu_tu: "miệng chữ tứ",
  khac: "dạng khác",
  vuong: "trán vuông",
  goc_tron: "trán góc tròn",
};

/** Nhãn đọc được của một giá trị phân loại (category). */
export const categoryLabel = (value: string): string =>
  FACE_TYPE_LABELS[value] ?? OTHER_CATEGORY_LABELS[value] ?? value;
