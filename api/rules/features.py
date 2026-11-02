"""Danh sách chỉ số khuôn mặt — nguồn sự thật cho lớp Python.

NGUỒN SỰ THẬT THẬT SỰ LÀ data/data-train/rules.json (PIPELINE.md mục 1): engine
phải chạy được với đúng các feature_key mà rules.json đang dùng. Danh sách dưới đây
phải khớp với accessors bên TypeScript (web/lib/engine/accessors.ts). Đổi tên ở
đây mà không sửa rules.json (hoặc ngược lại) thì seeder sẽ báo lỗi ngay.

BẢN V4 (data/README.md) thêm: cheekbone_height (quyền cao/thấp),
brow_tail_rise (đuôi mày ngược) và brow_kiem — luật GHÉP dùng op "all", tức
nhiều vế phải cùng khớp. brow_kiem không phải một phép đo: nó là tên của tướng
"mày lưỡi kiếm", còn giá trị nằm ở các vế trong rule["conditions"].

Bản trước lấy 20 key từ CLAUDE.md mục 7; dữ liệu thật soạn từ sách dùng bộ khác
(face_shape thay cho face_shape_ratio, thêm santing_balance và mouth_shape, bỏ
các chỉ số chưa có luật nào dùng).

BẢN V6 (data/README.md) thêm các bộ vị đo ở web/lib/features/bovi.ts và nhiều
luật ghép; mỗi luật ghép có feature_key trùng id của luật, ghi ở COMPOSITE_KEYS.

MẮT NẰM Ở LỚP 2: CLAUDE.md mục 7 chia 4 lớp và không có lớp nào cho mắt, nhưng
data/rules.json có luật eye_length/eye_size. Gộp vào lớp cung mày (đổi tên thành
"Cung mày & mắt") thay vì mở lớp thứ 5, để overlay màn 04 vẫn đúng 4 lớp như
mockup. Nếu sau này muốn tách riêng lớp Mắt thì phải sửa cả mockup lẫn overlay.
"""

from typing import Dict, List

# 4 lớp bóc tách, dùng cho overlay trên màn Kết quả.
FEATURE_LAYERS: Dict[str, Dict[str, str]] = {
    "Lớp 1 — Dáng mặt & tam đình": {
        "face_shape": "Ngũ hình (kim/mộc/thuỷ/hoả/thổ)",
        "santing_upper": "Tam đình - thượng đình (trí lực)",
        "santing_lower": "Tam đình - hạ đình (hoạt lực)",
        "santing_balance": "Tam đình cân đối (1 = cân)",
        "forehead_width": "Bề ngang trán",
        "forehead_shape": "Dạng trán (vuông/góc tròn) — xấp xỉ",
        "cheekbone_prominence": "Lưỡng quyền (gò má) nở",
        "cheekbone_height": "Lưỡng quyền cao / thấp (0 = ngang sống mũi)",
        "chin_width": "Bề ngang cằm",
        "chin_length": "Chiều dài cằm",
        "jaw_width": "Bề ngang hàm",
        "face_length": "Độ dài khuôn mặt",
        "face_round": "Độ tròn đầy của đường viền mặt",
        "chin_brow_square": "Cằm và trán vuông đều (luật ghép)",
        "chin_full_open": "Cằm và hàm đầy đặn (luật ghép)",
        "chin_long_narrow": "Cằm dài, thon (luật ghép)",
        "face_round_gentle": "Mặt rộng, tròn (luật ghép)",
        "forehead_brow_literary": "Trán rộng, mày thanh (luật ghép)",
    },
    "Lớp 2 — Cung mày & mắt": {
        "brow_curvature": "Độ cong cung mày (0 = thẳng)",
        "brow_length": "Chiều dài cung mày (1.0 = bằng mắt)",
        "brow_thickness": "Độ đậm cung mày",
        "brow_eye_gap": "Khoảng cách mày - mắt",
        "eye_length": "Chiều dài mắt (1.0 = trung bình)",
        "eye_size": "Độ mở của mắt",
        "brow_tail_rise": "Đuôi mày ngược lên (0 = ngang)",
        "brow_kiem": "Mày lưỡi kiếm (dài + thẳng + ngược đuôi)",
        "glabella_width": "Ấn đường — khoảng giữa hai đầu mày",
        "eye_spacing": "Khoảng cách hai mắt",
        "eye_tilt": "Đuôi mắt xếch (âm = rủ)",
        "eye_depth": "Độ sâu của mắt — xấp xỉ",
        "iris_ratio": "Tỉ lệ tròng đen so với mắt",
        "eye_brow_open_space": "Vùng giữa hai mắt, hai mày thoáng rộng (luật ghép)",
        "eye_lion": "Mắt lớn, mày đậm (luật ghép)",
        "eye_long_brow_clear": "Mắt nhỏ dài, mày thanh (luật ghép)",
        "eye_fine_gentle": "Mắt nhỏ, dài (luật ghép)",
        "eye_deep_fine": "Mắt nhỏ, sâu (luật ghép)",
        "iris_mouth_literary": "Tròng đen lớn, miệng rộng (luật ghép)",
        "eye_tail_down": "Đuôi mắt rủ, thượng đình dài (luật ghép)",
        "brow_fine_arched": "Mày mảnh, cong (luật ghép)",
        "brow_fine_long": "Mày mảnh, phẳng, dài (luật ghép)",
        "brow_straight_head_up": "Mày thẳng, đầu mày cao (luật ghép)",
        "brow_high_arch": "Mày cong cao như trăng non (luật ghép)",
        "brow_clear_fair": "Mày thanh, phẳng (luật ghép)",
        "brow_willow": "Mày lá liễu (luật ghép)",
        "brow_thick_eye_firm": "Mày đậm, mắt to (luật ghép)",
    },
    "Lớp 3 — Mũi & nhân trung": {
        "nose_wing_width": "Bề rộng cánh mũi",
        "nose_bridge_width": "Bề rộng sống mũi",
        "nasion_height": "Sơn căn cao / thấp — xấp xỉ",
        "nose_length": "Chiều dài mũi",
        "nose_ridge_width": "Bề ngang sống mũi ở sơn căn",
        "nose_tip_height": "Chuẩn đầu cao — xấp xỉ",
        "nose_tip_size": "Chuẩn đầu đầy đặn",
        "nose_straightness": "Sống mũi ngay (1 = thẳng)",
        "philtrum_length": "Nhân trung dài",
        "philtrum_straightness": "Nhân trung ngay (1 = thẳng)",
        "philtrum_taper": "Nhân trung trên hẹp dưới rộng — xấp xỉ",
        "nasion_straight_loyal": "Sống mũi thẳng liền tới sơn căn (luật ghép)",
        "nose_wide_long": "Mũi rộng và dài (luật ghép)",
        "nose_high_narrow": "Sống mũi cao, thon (luật ghép)",
        "nose_round_straight": "Mũi thẳng, đầu mũi tròn đầy (luật ghép)",
        "nose_deer": "Mũi đầy, đầu mũi tròn (luật ghép)",
        "nose_high_round": "Sống mũi cao, đầu mũi tròn (luật ghép)",
        "nose_leopard": "Mặt dài, mũi cao (luật ghép)",
        "philtrum_clear": "Nhân trung dài, rõ (luật ghép)",
    },
    "Lớp 4 — Miệng & môi": {
        "mouth_width": "Khoé miệng ngang",
        "lip_thickness": "Độ dày môi",
        "mouth_corner_angle": "Góc khoé miệng (âm = cụp)",
        "mouth_shape": "Dạng miệng (vòng cung/cọp/rồng/chữ tứ)",
        "mouth_level": "Miệng ngay ngắn (1 = hai khoé ngang)",
        "lip_balance": "Hai môi tương xứng (1 = bằng nhau)",
        "mouth_square_speech": "Miệng vuông vắn (luật ghép)",
        "lips_wide_even": "Môi rộng, ngay ngắn (luật ghép)",
    },
}

FEATURE_LABELS: Dict[str, str] = {
    key: label for layer in FEATURE_LAYERS.values() for key, label in layer.items()
}

FEATURE_KEYS: List[str] = list(FEATURE_LABELS)

# Ba chỉ số dạng phân loại; còn lại là số.
# Phải khớp CATEGORICAL bên web/lib/engine/accessors.ts.
CATEGORICAL_KEYS: List[str] = ["face_shape", "mouth_shape", "forehead_shape"]

# Chỉ số GHÉP: không đo trực tiếp, giá trị suy từ rule["conditions"].
# Phải khớp COMPOSITE_KEYS bên web/lib/engine/accessors.ts.
COMPOSITE_KEYS: List[str] = [
    "brow_kiem",
    "eye_brow_open_space",
    "nasion_straight_loyal",
    "nose_wide_long",
    "nose_high_narrow",
    "nose_round_straight",
    "nose_deer",
    "nose_high_round",
    "nose_leopard",
    "philtrum_clear",
    "chin_brow_square",
    "chin_full_open",
    "chin_long_narrow",
    "face_round_gentle",
    "eye_lion",
    "eye_long_brow_clear",
    "eye_fine_gentle",
    "eye_deep_fine",
    "iris_mouth_literary",
    "eye_tail_down",
    "brow_fine_arched",
    "brow_fine_long",
    "brow_straight_head_up",
    "brow_high_arch",
    "brow_clear_fair",
    "brow_willow",
    "brow_thick_eye_firm",
    "mouth_square_speech",
    "lips_wide_even",
    "forehead_brow_literary",
]

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
    # Luật ghép: mọi vế trong "conditions" phải cùng khớp.
    "all": ("conditions",),
}

# Toán tử cho phép ở MỘT VẾ của luật ghép — không lồng "all" trong "all",
# và không so phân loại ở vế con.
COND_OPS: Dict[str, tuple] = {
    "lt": ("v_max",),
    "lte": ("v_max",),
    "gt": ("v_min",),
    "gte": ("v_min",),
    "between": ("v_min", "v_max"),
}
