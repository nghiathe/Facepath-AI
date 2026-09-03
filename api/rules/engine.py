"""Rules engine — khớp luật và chấm điểm nghề. THUỘC MỐC 3, chưa hiện thực.

Theo CLAUDE.md mục 9, deterministic, không dùng LLM:
  1. Nhận vector đặc trưng (các key trong FEATURE_KEYS).
  2. Duyệt toàn bộ `rules`, giữ luật khớp điều kiện -> tập "luật khớp".
  3. Suy ra archetype từ face_shape_ratio + tam đình.
  4. Điểm mỗi nhóm nghề = tổng có trọng số của
     (rules.weight × rule_career_weights.weight), rồi chuẩn hoá về %.
     Ghi rõ công thức chuẩn hoá trong code, đừng hard-code số.
  5. Gom nét tính cách + nguồn từ các luật khớp mạnh nhất (khử trùng lặp
     theo trait) -> tối đa 4-6 thẻ trait.
  6. Trả JSON theo mục 10.
"""

from api.rules.features import FEATURE_KEYS  # noqa: F401  (dùng ở mốc 3)

__all__: list[str] = []
