"""Dựng danh mục nghề và trọng số luật → nghề từ O*NET + Danh mục nghề nghiệp Việt Nam.

Chạy:  python -I data/tools/build_occupations.py

Đầu vào (data/occupations/):
  occupation_map.tsv     bảng đối chiếu soạn tay: nhóm, mã VSCO, mã O*NET, tên, mô tả
  work_styles_matrix.csv mã O*NET rồi 16 cột theo DIMS, đơn vị 1/100 của thang
                         Work Styles Impact (WI, -3..+3), trích từ O*NET 31.0

Đầu ra (data/data-train/):
  occupations.json  mỗi nghề kèm work_styles (16 chiều)
  careers.json      14 nhóm nghề
  rules.json        chỉ ghi đè trường `careers` của từng luật
  trait_dims.json   chỉ cập nhật tên yếu tố O*NET tương ứng

Cách tính `careers`, ba bước:
  1. Lấy trung bình WI của các nghề trong nhóm theo từng chiều, quy về z-score giữa
     14 nhóm rồi ép về 0..1: nhóm nào nổi trội ở chiều đó thì điểm cao.
  2. Điểm thô của một luật với một nhóm là trung bình trên các trait_dims của luật.
  3. Trong từng nhóm, đổi điểm thô thành thứ hạng 0..1 rồi nâng luỹ thừa SHARPEN.

Bước 3 là bắt buộc. engine tính percent = tín hiệu đã khớp / tổng tín hiệu của nhóm,
nên nhóm có ít luật nặng ký sẽ dao động mạnh và hay lên đầu. Dùng thẳng điểm thô,
mô phỏng 8.000 khuôn mặt cho 44% người ra "Sản xuất & nghề kỹ thuật" và gần 0% ra
"Tâm lý, xã hội & nhân sự". Đổi sang thứ hạng thì nhóm nào cũng có cùng một phân
bố trọng số, nên không nhóm nào được lợi vì cách tính.

Con số này là lớp diễn giải của nhóm dự án, không phải kết luận của cổ thư.

Chỉ dùng thư viện chuẩn.
"""

from __future__ import annotations

import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "occupations"
TRAIN = ROOT / "data" / "data-train"

# Càng lớn thì các luật tiêu biểu của nhóm càng được nhấn, phổ % càng giãn.
SHARPEN = 2

# Dưới mức này coi như luật không gắn với nhóm, để cột "N đặc điểm" trên phiếu
# đếm đúng số luật liên quan tới nhóm chứ không phải mọi luật đã khớp.
MIN_WEIGHT = 0.15

# Cùng thứ tự với cột của work_styles_matrix.csv.
# O*NET 30.1 trở đi đổi bộ Work Styles (21 yếu tố 1.D.*, thang WI), nên 16 chiều
# cũ phải ánh xạ. independence và analytical_thinking không còn yếu tố trùng tên.
DIMS = {
    "achievement": "Achievement Orientation",
    "persistence": "Perseverance",
    "initiative": "Initiative",
    "leadership": "Leadership Orientation",
    "cooperation": "Cooperation",
    "concern_for_others": "Empathy",
    "social_orientation": "Social Orientation",
    "self_control": "Self-Control",
    "stress_tolerance": "Stress Tolerance",
    "adaptability": "Adaptability",
    "dependability": "Dependability",
    "attention_to_detail": "Attention to Detail",
    "integrity": "Integrity",
    "independence": "Self-Confidence + Tolerance for Ambiguity",
    "innovation": "Innovation",
    "analytical_thinking": "Intellectual Curiosity",
}

GROUPS = [
    ("cong-nghe-so", "Công nghệ thông tin & dữ liệu", "Kỹ sư phần mềm · nhà khoa học dữ liệu · chuyên viên an toàn thông tin"),
    ("ky-thuat-xay-dung", "Kỹ thuật & xây dựng", "Kỹ sư xây dựng · kỹ sư cơ khí · kiến trúc sư"),
    ("san-xuat-thu-cong", "Sản xuất & nghề kỹ thuật", "Thợ cơ khí · thợ điện · giám sát sản xuất"),
    ("tai-chinh-ke-toan", "Tài chính, kế toán & kiểm toán", "Kiểm toán viên · chuyên viên tín dụng · kế toán viên"),
    ("quan-ly-van-hanh", "Quản lý & vận hành", "Quản lý dự án · giám đốc điều hành · trưởng phòng quản lý chất lượng"),
    ("nghien-cuu-giang-day", "Nghiên cứu & giảng dạy", "Giảng viên · nhà thống kê · giáo viên trung học phổ thông"),
    ("phap-ly-hcc", "Pháp lý & hành chính công", "Luật sư · chuyên viên pháp chế · thanh tra viên"),
    ("kinh-doanh-truyen-thong", "Kinh doanh & truyền thông", "Nhân viên kinh doanh · chuyên viên marketing · nhà báo"),
    ("sang-tao-nghe-thuat", "Nghệ thuật, thiết kế & thể thao", "Nhà thiết kế đồ hoạ · đạo diễn · huấn luyện viên thể thao"),
    ("y-te-suc-khoe", "Y tế & chăm sóc sức khoẻ", "Bác sĩ · điều dưỡng · dược sĩ"),
    ("cong-dong-xa-hoi", "Tâm lý, xã hội & nhân sự", "Nhà tâm lý · nhân viên công tác xã hội · chuyên viên nhân sự"),
    ("du-lich-dich-vu", "Du lịch, ẩm thực & dịch vụ", "Hướng dẫn viên du lịch · đầu bếp · lễ tân khách sạn"),
    ("nong-lam-moi-truong", "Nông, lâm, thuỷ sản & môi trường", "Kỹ sư nông học · chuyên viên môi trường · chủ trang trại"),
    ("giao-thong-logistics", "Vận tải & logistics", "Phi công · chuyên viên logistics · nhân viên giao nhận vận tải"),
]


def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_matrix() -> dict[str, dict[str, float]]:
    out = {}
    with (SRC / "work_styles_matrix.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.reader(f):
            if len(row) != len(DIMS) + 1:
                raise SystemExit(f"dòng lỗi trong ma trận: {row[:2]}")
            out[row[0]] = {d: int(v) / 100 for d, v in zip(DIMS, row[1:])}
    return out


def load_occupations(matrix) -> list[dict]:
    occs = []
    for line in (SRC / "occupation_map.tsv").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        group, vsco, onet, name, desc = line.split("\t")
        if onet not in matrix:
            raise SystemExit(f"{name}: mã O*NET {onet} không có trong ma trận")
        occs.append({
            "name": name, "group": group, "vsco_code": vsco, "onet_code": onet,
            "description": desc, "work_styles": matrix[onet],
        })
    return occs


def group_weights(occs) -> dict[str, dict[str, float]]:
    """nhóm -> chiều -> độ nổi trội 0..1 của nhóm đó ở chiều đó."""
    means = {
        g: {d: statistics.fmean(o["work_styles"][d] for o in occs if o["group"] == g) for d in DIMS}
        for g, _, _ in GROUPS
    }
    out: dict[str, dict[str, float]] = defaultdict(dict)
    for d in DIMS:
        vals = [means[g][d] for g in means]
        mu, sd = statistics.fmean(vals), statistics.pstdev(vals)
        for g in means:
            # Nhóm trung bình ra 0.5, nổi hơn hai độ lệch ra 1.
            out[g][d] = max(0.0, min(1.0, 0.5 + (means[g][d] - mu) / sd / 4))
    return out


def percentile_ranks(vals: list[float]) -> list[float]:
    """Đổi điểm thô thành thứ hạng 0..1 trong nhóm; điểm bằng nhau nhận hạng trung bình."""
    order = sorted(vals)
    last = len(vals) - 1
    return [
        (order.index(v) + (last - order[::-1].index(v))) / 2 / last
        for v in vals
    ]


def main() -> None:
    occs = load_occupations(load_matrix())
    weights = group_weights(occs)

    dump(TRAIN / "occupations.json", occs)
    dump(TRAIN / "careers.json", [
        {"slug": s, "name": n, "sample_jobs": j, "sort_order": i}
        for i, (s, n, j) in enumerate(GROUPS, 1)
    ])

    rules_path = TRAIN / "rules.json"
    rules = json.loads(rules_path.read_text(encoding="utf-8"))
    raw = {
        g: [statistics.fmean(weights[g][d] for d in r["trait_dims"]) for r in rules]
        for g, _, _ in GROUPS
    }
    ranked = {g: percentile_ranks(vals) for g, vals in raw.items()}
    for i, r in enumerate(rules):
        w = {g: round(ranked[g][i] ** SHARPEN, 2) for g, _, _ in GROUPS}
        r["careers"] = {g: v for g, v in w.items() if v >= MIN_WEIGHT}
    dump(rules_path, rules)

    dims_path = TRAIN / "trait_dims.json"
    doc = json.loads(dims_path.read_text(encoding="utf-8"))
    for d in doc:
        d["onet"] = DIMS[d["id"]]
    dump(dims_path, doc)

    print(f"{len(occs)} nghề · {len(GROUPS)} nhóm · {len(rules)} luật")


if __name__ == "__main__":
    main()
