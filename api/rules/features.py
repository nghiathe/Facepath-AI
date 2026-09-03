"""Danh sách chỉ số khuôn mặt — nguồn sự thật cho lớp Python.

NGUỒN SỰ THẬT THẬT SỰ LÀ data/rules.json (PIPELINE.md mục 1): engine phải chạy
được với đúng 14 feature_key mà 26 luật đang dùng. Danh sách dưới đây phải khớp
với accessors bên TypeScript (web/lib/engine/accessors.ts). Đổi tên ở đây mà
không sửa rules.json (hoặc ngược lại) thì seeder sẽ báo lỗi ngay.

Bản trước lấy 20 key từ CLAUDE.md mục 7; dữ liệu thật soạn từ sách dùng bộ khác
(face_shape thay cho face_shape_ratio, thêm santing_balance và mouth_shape, bỏ
các chỉ số chưa có luật nào dùng).
"""

from typing import Dict, List

# 4 lớp bóc tách, dùng cho overlay trên màn Kết quả.
FEATURE_LAYERS: Dict[str, Dict[str, str]] = {
    "Lớp 1 — Dáng mặt & tam đình": {
        "face_shape": "Ngũ hình (kim/mộc/thuỷ/hoả/thổ)",
        "santing_upper": "Tam đình - thượng đình (trí lực)",
        "santing_lower": "Tam đình - hạ đình (hoạt lực)",
        "santing_balance": "Tam đình cân đối (1 = cân)",
    },
    "Lớp 2 — Cung mày": {
        "brow_curvature": "Độ cong cung mày (0 = thẳng)",
        "brow_length": "Chiều dài cung mày (1.0 = bằng mắt)",
        "brow_thickness": "Độ đậm cung mày",
        "brow_eye_gap": "Khoảng cách mày - mắt",
    },
    "Lớp 3 — Mũi": {
        "nose_wing_width": "Bề rộng cánh mũi",
        "nose_bridge_width": "Bề rộng sống mũi",
    },
    "Lớp 4 — Miệng & môi": {
        "mouth_width": "Khoé miệng ngang",
        "lip_thickness": "Độ dày môi",
        "mouth_corner_angle": "Góc khoé miệng (âm = cụp)",
        "mouth_shape": "Dạng miệng (vòng cung/cọp/rồng/chữ tứ)",
    },
}

FEATURE_LABELS: Dict[str, str] = {
    key: label for layer in FEATURE_LAYERS.values() for key, label in layer.items()
}

FEATURE_KEYS: List[str] = list(FEATURE_LABELS)

# Hai chỉ số dạng phân loại; còn lại là số.
CATEGORICAL_KEYS: List[str] = ["face_shape", "mouth_shape"]

# 4 chỉ số hiển thị live trên màn Quét (CLAUDE.md mục 7).
LIVE_FEATURE_KEYS: List[str] = [
    "face_shape",
    "brow_curvature",
    "nose_wing_width",
    "mouth_width",
]

# Toán tử hợp lệ của cột rules.op (CLAUDE.md mục 6) -> trường ngưỡng bắt buộc.
OPS_REQUIRING: Dict[str, tuple] = {
    "lt": ("v_max",),
    "lte": ("v_max",),
    "gt": ("v_min",),
    "gte": ("v_min",),
    "between": ("v_min", "v_max"),
    "category": ("category",),
}
