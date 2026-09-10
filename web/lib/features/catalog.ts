// Danh mục chỉ số khuôn mặt cho phía trình duyệt — bản đối chiếu của
// api/rules/features.py (FEATURE_LAYERS / FEATURE_LABELS).
//
// VÌ SAO CHÉP LẠI THAY VÌ GỌI /api/features: trang "Khám phá" tra cứu chính bộ
// luật mà engine đang chạy (data/rules.json đã nằm sẵn trong bundle qua
// lib/data.ts). Bắt trang tra cứu phụ thuộc MySQL + FastAPI đang bật thì lúc
// bảo vệ đồ án chỉ cần backend chưa chạy là cả tab trống trơn.
//
// Nguồn sự thật vẫn là data/rules.json. catalog.test.ts kiểm tra: mọi
// feature_key trong rules.json đều có nhãn ở đây, và không có nhãn thừa.

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
    },
  },
  {
    layer: "Lớp 3 — Mũi",
    keys: {
      nose_wing_width: "Bề rộng cánh mũi",
      nose_bridge_width: "Bề rộng sống mũi",
    },
  },
  {
    layer: "Lớp 4 — Miệng & môi",
    keys: {
      mouth_width: "Khoé miệng ngang",
      lip_thickness: "Độ dày môi",
      mouth_corner_angle: "Góc khoé miệng (âm = cụp)",
      mouth_shape: "Dạng miệng (vòng cung / cọp / rồng / chữ tứ)",
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
