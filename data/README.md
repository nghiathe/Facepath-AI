# Dữ liệu tướng học cho app

Bộ dữ liệu này được soạn trực tiếp từ cuốn **Nhân Tướng Học (Hy Trương)** đã số hoá, dùng để nạp (seed) vào các bảng `sources`, `career_groups`, `rules`, `rule_career_weights` mô tả trong `CLAUDE.md`.

## Các file
- `sources.json` — danh mục nguồn dẫn (cuốn sách chính + các cổ thư được trích lại trong sách).
- `careers.json` — 6 nhóm nghề, đúng thứ tự và mô tả trong mockup.
- `face_types.json` — 5 kiểu tướng ngũ hình (kim/mộc/thủy/hỏa/thổ) dùng làm **archetype** hiển thị trên phiếu.
- `rules.json` — bộ luật: mỗi luật khớp một đặc trưng khuôn mặt → một nét tính cách (`trait`) có `source` + `citation`, kèm trọng số đóng góp cho từng nhóm nghề (`careers`).

## Đặc trưng (feature_key) ↔ chương trong sách
- `face_shape` (kim/mộc/thủy/hỏa/thổ) ← Quyển I, *Ngũ hành hình tướng*
- `santing_upper` / `santing_lower` / `santing_balance` ← Chương I, *Tam Đình* (thượng đình = Trí lực, trung đình = Khí lực, hạ đình = Hoạt lực)
- `brow_*` ← Chương II, *Lông Mày*
- `nose_*` ← Chương IV, *Mũi*
- `mouth_*` / `lip_*` / `mouth_shape` ← Chương V, *Môi Miệng*
- `eye_size` / `eye_length` ← Chương *Mắt* (mắt phượng → thông tuệ học thuật; tròng đen lớn → chí khí cao)
- `forehead_width` / `forehead_shape` ← Chương *Trán* (trán vuông → óc thực nghiệp; trán góc tròn → văn học nghệ thuật)
- `cheekbone_prominence` ← Chương *Lưỡng Quyền* (quyền cao/nở → tự tin, uy quyền)

## Bản mở rộng (v2): mắt, trán, lưỡng quyền, tai
- `rules.json` đã tăng từ 26 → **32 luật** (thêm mắt, trán, gò má).
- `rules_ear.json` (**tách riêng, 2 luật tai**): tai **KHÔNG** nằm trong 478 điểm của MediaPipe FaceMesh, nên các luật này không tự chạy trong MVP. Muốn dùng phải có model phát hiện tai riêng hoặc cho người dùng nhập tay. Mỗi luật có trường `requires` ghi rõ điều này.
- Vài luật trong `rules.json` có trường `requires` = "cần phân loại hình trán từ chân tóc (xấp xỉ)" (các luật `forehead_shape`): `features.ts` cần một hàm phân loại hình trán; trước khi có, chúng đơn giản không khớp (engine bỏ qua an toàn feature_key chưa có accessor).

**Feature mới cần thêm ở tầng code** (đã làm sẵn trong gói `engine/`): thêm nhóm `eyes`, `forehead`, `cheekbone` vào `FaceFeatures` (types.ts), và accessor tương ứng (`eye_size`, `eye_length`, `forehead_width`, `forehead_shape`, `cheekbone_prominence`) trong accessors.ts.

`santing_balance` và `mouth_shape` là các trường **suy ra** ở client (mục 7 của CLAUDE.md): `santing_balance` = mức gần với tỉ lệ 33/34/33; `mouth_shape` phân loại từ độ rộng miệng + độ dày/cong môi (vòng cung, cọp, rồng, chữ tứ...).

## Ghi chú quan trọng về tính trung thực của dữ liệu
Hai lớp thông tin có **độ tin cậy khác nhau**, cần phân biệt rõ trong UI:

1. **`trait` + `reading_hint` + `source` + `citation`** — lấy trực tiếp từ sách. Đây là phần kiểm chứng được: người dùng có thể tra lại đúng chương/mục.
2. **`careers` (trọng số nghề)** — là **lớp diễn giải do nhóm dự án thêm vào**. Sách cổ mô tả đặc điểm → *tính cách / phú quý bần tiện*, chỉ đôi chỗ nói thẳng tới nghề (ví dụ *miệng vòng cung* → “văn học, nghiên cứu”; *mày cọp* → “nghề cạnh tranh, thực nghiệp gia”; *cánh mũi cân xứng* → “khéo léo về kỹ thuật”). Các trọng số còn lại được suy từ tính cách sang 6 nhóm nghề hiện đại theo logic ngũ thường (Kim–Nghĩa, Mộc–Nhân, Thủy–Trí, Hỏa–Lễ, Thổ–Tín). **Không nên trình bày phần này như kết luận của cổ thư.**

Vì vậy phiếu kết quả nên: trích dẫn nguồn cho *trait*, còn phần % nghề giữ đúng nhãn “mức khớp giữa đặc điểm đọc được và mô tả trong ngữ liệu”, không phải dự báo thành công — như disclaimer đã quy định.

## Cách mở rộng
- Thêm luật: copy một object trong `rules.json`, đổi `feature_key`/ngưỡng/`trait`/`careers`, và **bắt buộc** điền `source` + `citation` trỏ về đúng chỗ trong sách.
- Sách còn nhiều bộ vị chưa khai thác (Mắt, Tai, Trán, Lưỡng Quyền, Nhân Trung, Pháp Lệnh, Ngũ Nhạc...). Có thể bổ sung dần khi thêm feature_key tương ứng ở `features.ts`.
- Với RAG: nạp toàn văn từng chương vào `corpus_chunks` để LLM viết luận giải bám sát, còn điểm số nghề vẫn do rules engine tính (deterministic).
