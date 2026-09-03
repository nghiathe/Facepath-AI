"""Danh sách chỉ số khuôn mặt — nguồn sự thật duy nhất.

Bám theo CLAUDE.md mục 7. Dùng chung cho: seeder (validate rules.json),
API (/api/health, /api/rules) và rules engine (mốc 3).

LƯU Ý VỀ SỐ LƯỢNG: mục 7 viết "~24 chỉ số" nhưng chỉ đặt tên 20 key
(lớp 1: 8, các lớp 2-4: mỗi lớp 4). Ở đây lấy đúng 20 key có tên làm chuẩn.
Mọi chỗ hiển thị số lượng phải tính từ len(FEATURE_KEYS), không hard-code
số 24 — theo yêu cầu mục 13. Thêm chỉ số mới thì UI tự cập nhật theo.
"""

from typing import Dict, List

# 4 lớp bóc tách đúng như mục 7 và như overlay trên màn Kết quả.
FEATURE_LAYERS: Dict[str, Dict[str, str]] = {
    "Lớp 1 — Dáng mặt & tam đình": {
        "face_shape_ratio": "Tỉ lệ dáng mặt (suy ra ngũ hình)",
        "face_width": "Bề rộng mặt",
        "face_height": "Chiều dài mặt",
        "jaw_width": "Bề rộng hàm",
        "cheekbone_width": "Bề rộng gò má",
        "santing_upper": "Tam đình - tầng trán",
        "santing_middle": "Tam đình - tầng mũi",
        "santing_lower": "Tam đình - tầng cằm",
    },
    "Lớp 2 — Cung mày": {
        "brow_curvature": "Độ cong cung mày",
        "brow_length": "Chiều dài cung mày",
        "brow_thickness": "Độ đậm cung mày",
        "brow_eye_gap": "Khoảng cách mày - mắt",
    },
    "Lớp 3 — Mũi": {
        "nose_wing_width": "Bề rộng cánh mũi",
        "nose_length": "Chiều dài mũi",
        "nose_bridge_width": "Bề rộng sống mũi",
        "nose_tip_ratio": "Tỉ lệ đầu mũi",
    },
    "Lớp 4 — Miệng & môi": {
        "mouth_width": "Khoé miệng ngang",
        "lip_thickness": "Độ dày môi",
        "lip_balance": "Cân đối môi trên/dưới",
        "mouth_corner_angle": "Góc khoé miệng",
    },
}

FEATURE_LABELS: Dict[str, str] = {
    key: label for layer in FEATURE_LAYERS.values() for key, label in layer.items()
}

FEATURE_KEYS: List[str] = list(FEATURE_LABELS)

# 4 chỉ số hiển thị live trên màn Quét (mục 7).
LIVE_FEATURE_KEYS: List[str] = [
    "face_shape_ratio",
    "brow_curvature",
    "nose_wing_width",
    "mouth_width",
]

# Toán tử hợp lệ của cột rules.op (mục 6) -> trường ngưỡng bắt buộc đi kèm.
OPS_REQUIRING: Dict[str, tuple] = {
    "lt": ("v_max",),
    "lte": ("v_max",),
    "gt": ("v_min",),
    "gte": ("v_min",),
    "between": ("v_min", "v_max"),
    "category": ("category",),
}
