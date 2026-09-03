# Facepath-AI

Ứng dụng quét gương mặt, đối chiếu với bộ luật tướng học cổ đã số hoá và gợi ý
nhóm nghề phù hợp. Đồ án Khoa Công nghệ thông tin & Kinh tế số — Học viện Ngân hàng.

> **Tướng học là tri thức văn hoá dân gian, không phải kết luận khoa học.**
> Kết quả chỉ để tham khảo và giải trí, không dùng cho tuyển dụng, xét học bổng
> hay đánh giá năng lực. Tỉ lệ % là *mức khớp* giữa đặc điểm đọc được và mô tả
> trong ngữ liệu, không phải dự báo thành công nghề nghiệp.

Đặc tả đầy đủ nằm ở [`CLAUDE.md`](./CLAUDE.md).

## Trạng thái: Mốc 1 (khung dự án)

Đã xong: scaffold Next.js + FastAPI + MySQL, seed nhóm nghề / nguồn / luật.
Chưa làm: camera (mốc 2), rules engine và `POST /api/analyze` (mốc 3),
RAG + LLM (mốc 5). Xem `CLAUDE.md` mục 12.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `web/` | Next.js 16 + React 19 + Tailwind 4 (App Router, TypeScript) |
| `api/` | FastAPI + PyMySQL |
| `data/` | Nguồn sự thật cho seed: `careers.json`, `sources.json`, `traits.json`, `rules.json` |
| `design/` | Mockup gốc (tham chiếu, không sửa) |

## Chạy backend

Cần một MySQL 8 đang chạy (local hoặc managed).

```bash
python -m venv .venv
source .venv/Scripts/activate      # Windows Git Bash; Linux/macOS: source .venv/bin/activate
pip install -r api/requirements.txt

cp .env.example .env               # rồi điền MYSQL_* cho đúng máy bạn

python -m api.db.seed_all --check  # kiểm tra /data, chưa cần MySQL
python -m api.db.init_db           # tạo database + 7 bảng
python -m api.db.seed_all          # nạp careers / sources / traits / rules

uvicorn api.main:app --reload --port 8000
```

Kiểm tra nhanh:

```bash
curl localhost:8000/api/health
curl localhost:8000/api/careers
curl "localhost:8000/api/rules?feature=brow_curvature"
```

Tài liệu API tự sinh: <http://localhost:8000/docs>

## Chạy frontend

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev                        # http://localhost:3000
```

## Soạn tiếp bộ luật

`data/rules.json` là bảng công việc. Mỗi mục có cờ `verified`:

- `verified: true` — đã có `source` + `citation` cụ thể, seeder nạp vào DB.
- `verified: false` — khung trống, seeder **bỏ qua**.

Nhờ vậy CSDL luôn chỉ chứa luật kiểm chứng được, đúng nguyên tắc *"Kết quả phải
kiểm chứng được"* ở `CLAUDE.md` mục 1. Điền xong một luật thì đổi `verified`
thành `true`, chạy `python -m api.db.seed_all --check` để soát lỗi, rồi
`python -m api.db.seed_all` để nạp lại.

Seeder sẽ chặn nếu: `feature_key` không có trong mục 7, `op` thiếu ngưỡng đi kèm,
thiếu `citation`, `source` không có trong `sources.json`, slug nghề sai, hoặc
trọng số nằm ngoài khoảng 0..1.

## Ràng buộc riêng tư

Ảnh và khung hình **không bao giờ rời thiết bị**. Server chỉ nhận vector số.
Không thêm bất kỳ endpoint nào nhận file ảnh — nếu một tính năng cần ảnh ở
server thì dừng lại và hỏi trước (`CLAUDE.md` mục 1 và 13).
