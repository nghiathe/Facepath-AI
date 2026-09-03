# Facepath-AI

Ứng dụng quét gương mặt, đối chiếu với bộ luật tướng học cổ đã số hoá và gợi ý
nhóm nghề phù hợp. Đồ án Khoa Công nghệ thông tin & Kinh tế số — Học viện Ngân hàng.

> **Tướng học là tri thức văn hoá dân gian, không phải kết luận khoa học.**
> Kết quả chỉ để tham khảo và giải trí, không dùng cho tuyển dụng, xét học bổng
> hay đánh giá năng lực. Tỉ lệ % là *mức khớp* giữa đặc điểm đọc được và mô tả
> trong ngữ liệu, không phải dự báo thành công nghề nghiệp.

Đặc tả: [`CLAUDE.md`](./CLAUDE.md) (tổng thể) và [`PIPELINE.md`](./PIPELINE.md)
(luồng ảnh → feature → luật → trait → nghề).

## Trạng thái

| Phần | Trạng thái |
|---|---|
| Khung dự án (Next.js + FastAPI + MySQL) | xong |
| Dữ liệu tướng học soạn từ sách (`data/`) | xong — 26 luật, 14 chỉ số, 5 ngũ hình |
| `features.ts` — landmarks → FaceFeatures | xong (chưa hiệu chỉnh ngưỡng) |
| Rule engine + trait + chấm điểm nghề | xong, có test |
| Bật camera thật trên màn Quét | chưa (mốc 2) |
| Nối engine vào UI, phiếu kết quả | chưa |
| Hiệu chỉnh ngưỡng trên ảnh thật | **chưa — bắt buộc trước khi tin con số %** |
| RAG + LLM | chưa (mốc 5) |

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `web/` | Next.js 16 + React 19 + Tailwind 4 |
| `web/lib/features/` | Trích đặc trưng từ 478 điểm mốc MediaPipe |
| `web/lib/engine/` | Khớp luật, gom trait, chấm điểm nghề (TypeScript thuần) |
| `api/` | FastAPI + PyMySQL — phục vụ tra cứu luật/nghề |
| `data/` | Nguồn sự thật: `rules.json`, `careers.json`, `sources.json`, `face_types.json` |
| `design/` | Mockup gốc (tham chiếu, không sửa) |

Engine chạy **phía client**, nên ảnh lẫn bộ luật đều không cần rời máy.

## Chạy frontend

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev          # http://localhost:3000
npm test             # 41 test cho features + engine
npm run test:watch
```

## Chạy backend

Cần một MySQL 8 đang chạy (local hoặc managed).

```bash
python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash; Linux/macOS: .venv/bin/activate
pip install -r api/requirements.txt

cp .env.example .env               # rồi điền MYSQL_*

python -m api.db.seed_all --check  # soát /data, chưa cần MySQL
python -m api.db.init_db           # tạo database + 7 bảng
python -m api.db.seed_all          # nạp sources / careers / traits / rules

uvicorn api.main:app --reload --port 8000
```

Kiểm tra: `curl localhost:8000/api/health`, `/api/careers`,
`"/api/rules?feature=brow_curvature"`. Tài liệu tự sinh: <http://localhost:8000/docs>

## Soạn tiếp bộ luật

`data/rules.json` là nguồn sự thật — cả engine TypeScript lẫn seeder Python đều
đọc từ đó. Thêm luật: copy một object, đổi `feature_key`/ngưỡng/`trait`/`careers`,
và **bắt buộc** điền `source` (id trong `sources.json`) + `citation` trỏ đúng
chương trong sách.

Soát lại bằng `python -m api.db.seed_all --check` và `npm test`. Hai lớp kiểm tra
sẽ chặn nếu: `feature_key` không nằm trong 14 chỉ số, `op` thiếu ngưỡng đi kèm,
thiếu `citation`, `source` không có thật, slug nghề sai, trọng số ngoài 0..1,
hoặc `id` luật bị trùng.

Thêm một `feature_key` mới thì phải sửa **ba** chỗ, nếu không luật sẽ bị bỏ qua
lặng lẽ: `data/rules.json`, `web/lib/engine/accessors.ts`, `api/rules/features.py`.
Test `engine.test.ts` bắt được trường hợp thiếu accessor.

## Hai lớp dữ liệu có độ tin cậy khác nhau

Theo [`data/README.md`](./data/README.md):

1. `trait` + `reading_hint` + `source` + `citation` — **lấy trực tiếp từ sách**,
   người dùng tra lại được đúng chương/mục.
2. `careers` (trọng số nghề) — **lớp diễn giải do nhóm dự án thêm vào**, suy từ
   tính cách sang 6 nhóm nghề hiện đại. Không được trình bày như kết luận của cổ thư.

Vì vậy phiếu kết quả trích nguồn cho *trait*, còn % nghề giữ đúng nhãn
"mức khớp đặc điểm".

## Ràng buộc riêng tư

Ảnh và khung hình **không bao giờ rời thiết bị**. Không thêm endpoint nào nhận
file ảnh — nếu một tính năng cần ảnh ở server thì dừng lại và hỏi trước
(`CLAUDE.md` mục 1 và 13).
