# CLAUDE.md — Ứng dụng quét gương mặt dự đoán nhóm nghề

> Đặt file này ở thư mục gốc của repo. Claude Code sẽ tự đọc nó làm ngữ cảnh dự án.
> Đây là **đồ án** của Khoa Công nghệ thông tin & Kinh tế số — Học viện Ngân hàng (SV: Nguyễn An · K26).
> Giao diện đã được thiết kế xong (xem `design/face-career-app.html`). Nhiệm vụ là **hiện thực hoá chức năng** bám sát mockup này.

---

## 1. Mục tiêu & phạm vi

Xây web app cho phép người dùng quét gương mặt bằng camera trình duyệt, đối chiếu đặc điểm với **bộ luật tướng học cổ đã số hoá**, rồi trả về một "phiếu luận giải" gồm: kiểu tướng (ngũ hình), luận giải tiếng Việt có trích dẫn nguồn, và bảng **nhóm nghề phù hợp** kèm % tương hợp.

### Nguyên tắc bất di bất dịch (đọc kỹ trước khi code)
- **Ảnh không bao giờ rời thiết bị.** Toàn bộ việc bắt camera + trích điểm mốc chạy trên trình duyệt. Server **chỉ nhận ~24 con số** (vector đặc trưng), không nhận ảnh, không nhận khung hình.
- **Đây là tri thức văn hoá dân gian, không phải khoa học.** Mọi màn hình phải giữ dòng disclaimer: kết quả chỉ để tham khảo/giải trí, **không dùng cho tuyển dụng, xét học bổng hay đánh giá năng lực**. Không được bỏ, không được làm mờ nhạt.
- **% tương hợp = mức khớp giữa đặc điểm đọc được và mô tả trong ngữ liệu**, KHÔNG phải dự báo thành công nghề nghiệp. Diễn đạt đúng như vậy ở UI.
- **Kết quả phải kiểm chứng được.** Mọi nét tính cách trong luận giải phải gắn với luật + nguồn cụ thể (tên sách, quyển/trang). LLM chỉ diễn đạt, không tự bịa kết luận.

### Không làm (non-goals)
- Không nhận diện danh tính / so khớp khuôn mặt với người thật.
- Không lưu trữ ảnh trên server dưới bất kỳ hình thức nào.
- Không đưa ra chẩn đoán y tế, tâm lý hay khẳng định về tính cách cá nhân như sự thật.

---

## 2. Kiến trúc tổng thể

```
[Trình duyệt — on-device]                         [Server]
 Camera / upload
      ↓
 MediaPipe Face Landmarker (478 điểm)
      ↓
 Trích đặc trưng → vector ~24 số      ── POST /api/analyze (chỉ gửi số) ──▶  Rules engine (khớp luật, tính điểm nghề)
      ↓                                                                          ↓
 Hiển thị lớp bóc tách trên ảnh                                            RAG (truy hồi đoạn ngữ liệu) + LLM (sinh luận giải)
      ↓                                                                          ↓
 Nhận phiếu kết quả  ◀───────────────── JSON: archetype, luật khớp, nghề, luận giải, nguồn ───
```

- Xử lý khuôn mặt và trích đặc trưng: **client (TypeScript)**.
- Chấm điểm luật + nghề: **deterministic trên server** (không phụ thuộc LLM để đảm bảo ổn định và kiểm chứng được).
- LLM chỉ dùng để **viết đoạn văn luận giải** từ các luật đã khớp + đoạn ngữ liệu truy hồi được (RAG).

---

## 3. Tech stack (đã chốt)

| Lớp | Lựa chọn |
|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript** |
| Styling | Tailwind CSS, cấu hình theo design token ở mục 5 |
| Nhận diện khuôn mặt | **@mediapipe/tasks-vision** — Face Landmarker (478 điểm), chạy WASM trong trình duyệt |
| Backend | **FastAPI (Python 3.11+)** |
| Database | **MySQL 8+** (dữ liệu quan hệ) |
| Vector search (RAG) | Corpus nhỏ (1 vài cuốn sách) → **tính cosine bằng numpy/FAISS trong tiến trình Python**, không cần index ANN. Lưu embedding dạng JSON/BLOB trong MySQL hoặc file `.npy`. |
| Embeddings | `bge-m3` (đa ngữ, tốt cho tiếng Việt) qua `sentence-transformers`, hoặc API embeddings đa ngữ |
| LLM | Gọi API (Claude/GPT) để sinh luận giải tiếng Việt, có streaming |
| Font | **Be Vietnam Pro** (đã dùng trong mockup) |
| Triển khai | Vercel (FE) + Railway/Render (BE) + MySQL managed |

> Nếu muốn MVP nhanh cho buổi bảo vệ đồ án: có thể tạm bỏ LLM, dùng **template ghép câu** từ các luật khớp (mục 9 có mô tả). Cấu trúc API giữ nguyên để sau này cắm LLM vào.

---

## 4. Cấu trúc thư mục đề xuất

```
/design
  face-career-app.html         # mockup gốc (tham chiếu, không sửa)
/web                           # Next.js frontend
  /app
    page.tsx                   # Màn 01 Trang chủ
    /scan/page.tsx             # Màn 02 Quét
    /analyze/page.tsx          # Màn 03 Đang phân tích
    /result/page.tsx           # Màn 04 Phiếu kết quả
    /library/page.tsx          # "Kho luận giải" (tra cứu luật + nguồn)
    /about/page.tsx            # "Về phương pháp"
  /lib
    landmarks.ts               # bọc MediaPipe Face Landmarker
    features.ts                # 478 điểm → vector 24 số (mục 7)
    overlay.ts                 # vẽ lớp bóc tách lên canvas
    api.ts                     # gọi backend
  /components                  # Header, DisclaimerBanner, CareerBar, TraitCard, ...
/api                           # FastAPI backend
  main.py
  /rules/engine.py             # khớp luật + tính điểm nghề (deterministic)
  /rag/retriever.py            # embeddings + cosine
  /llm/reading.py              # sinh luận giải có trích dẫn
  /db/schema.sql               # DDL MySQL (mục 6)
  /db/seed_*.py                # nạp luật, nhóm nghề, nguồn, chunk ngữ liệu
/data
  /corpus                      # cổ thư đã số hoá (txt/md)
  rules.json                   # bộ luật soạn từ sách (mục 8)
  careers.json                 # 6 nhóm nghề (mục 8)
  sources.json                 # danh mục nguồn dẫn
```

---

## 5. Design system (trích từ mockup — dùng đúng)

**Màu**
- Navy chính: `#232B76`; đậm hơn: `#161C4E`; đậm nhất: `#10142E`
- Vàng/hổ phách (accent): `#F0A81E`; biến thể chữ: `#C4881A`
- Nền trang: `#faf9f5`; nền surface/phiếu: `#F6F3EC`; thẻ: `#ffffff`
- Chữ: tiêu đề `#161C4E`; nội dung `#5C5849`; phụ `#6B6656` / `#7A7565`
- Viền: `rgba(35,43,118,0.12)` (nhạt) → `rgba(35,43,118,0.2)` (đậm)

**Chữ**
- Hệ chữ duy nhất: **Be Vietnam Pro** (weights 200/300/400/600/700).
- Tiêu đề lớn 600, letter-spacing âm nhẹ (`-0.02em`); nội dung 300–400, line-height ~1.65.
- Nhãn nhỏ in hoa, letter-spacing ~`0.18em`, màu `#7A7565`/`#C4881A`.

**Hình khối**
- Bo góc nhỏ: nút `3px`, thẻ/khung `6px`. Giao diện phẳng, đổ bóng mềm rất nhẹ (`0 30px 60px -30px rgba(16,20,46,0.35)` cho khung màn).
- Mockup vẽ ở khổ 1280×800 (desktop-first). Bản chạy thật **phải responsive**: desktop giữ bố cục 1 cột trung tâm; mobile xếp dọc, camera full-width.

**Header** (mọi màn): logo Khoa · 3 mục "Quét gương mặt / Kho luận giải / Về phương pháp" · tên người dùng + avatar chữ cái.

---

## 6. Cơ sở dữ liệu (MySQL — `db/schema.sql`)

Không có bảng nào chứa ảnh. `sessions` chỉ lưu vector số + kết quả (tùy chọn, để làm trang lịch sử).

```sql
CREATE TABLE sources (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  title        VARCHAR(255) NOT NULL,      -- vd "Ma Y Thần Tướng"
  citation     VARCHAR(255),               -- vd "q.2" / "tr.88"
  note         TEXT
);

CREATE TABLE traits (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  label        VARCHAR(120) NOT NULL,      -- vd "Kiên định, bền chí"
  description  TEXT
);

CREATE TABLE career_groups (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  slug         VARCHAR(80) UNIQUE NOT NULL,
  name         VARCHAR(120) NOT NULL,      -- vd "Kỹ thuật & công nghệ"
  sample_jobs  TEXT,                        -- vd "Kỹ sư dữ liệu · lập trình viên · ..."
  sort_order   INT DEFAULT 0
);

-- Một "luật" = một điều kiện trên 1 đặc trưng → suy ra 1 nét tính cách, có nguồn
CREATE TABLE rules (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  feature_key  VARCHAR(60) NOT NULL,       -- vd "brow_curvature" (mục 7)
  op           ENUM('lt','lte','gt','gte','between','category') NOT NULL,
  v_min        FLOAT,                       -- ngưỡng / cận dưới
  v_max        FLOAT,                       -- cận trên (cho 'between')
  category     VARCHAR(60),                 -- cho op='category' (vd face_shape='kim')
  trait_id     INT NOT NULL,
  source_id    INT NOT NULL,
  reading_hint VARCHAR(255),               -- mảnh câu để LLM/template dùng
  weight       FLOAT DEFAULT 1.0,
  FOREIGN KEY (trait_id)  REFERENCES traits(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- Mỗi luật đóng góp điểm cho một hoặc nhiều nhóm nghề
CREATE TABLE rule_career_weights (
  rule_id          INT NOT NULL,
  career_group_id  INT NOT NULL,
  weight           FLOAT NOT NULL,          -- 0..1
  PRIMARY KEY (rule_id, career_group_id),
  FOREIGN KEY (rule_id) REFERENCES rules(id),
  FOREIGN KEY (career_group_id) REFERENCES career_groups(id)
);

-- Ngữ liệu cổ thư cho RAG
CREATE TABLE corpus_chunks (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  source_id    INT NOT NULL,
  content      TEXT NOT NULL,
  embedding    JSON,                        -- mảng float (hoặc lưu file .npy riêng)
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- (Tùy chọn) lưu phiên để làm lịch sử — TUYỆT ĐỐI không lưu ảnh
CREATE TABLE sessions (
  id           CHAR(36) PRIMARY KEY,        -- uuid
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  archetype    VARCHAR(80),                 -- vd "kim hình - mặt chữ Nhật"
  features     JSON,                        -- 24 số
  result       JSON                         -- kết quả đầy đủ để render lại
);
```

---

## 7. Trích đặc trưng khuôn mặt (`web/lib/features.ts`)

Từ 478 điểm mốc MediaPipe, tính ra **~24 chỉ số** đã chuẩn hoá (chia cho khoảng cách 2 mắt để bất biến với kích thước ảnh), gom thành **4 lớp** đúng như mockup. Tên `feature_key` phải khớp với cột `rules.feature_key`.

**Lớp 1 — Dáng mặt & tam đình**
- `face_shape_ratio` (Tỉ lệ dáng mặt, vd 0.72 = rộng/dài) → suy ra ngũ hình: kim (vuông), mộc (dài), thuỷ (tròn/đầy), hoả (nhọn trên), thổ (dày vững).
- `face_width`, `face_height`, `jaw_width`, `cheekbone_width`
- `santing_upper`, `santing_middle`, `santing_lower` (Tam đình: trán / mũi / cằm — tỉ lệ 3 tầng, lý tưởng ~33/34/33)

**Lớp 2 — Cung mày**
- `brow_curvature` (Độ cong cung mày, vd 0.41 = thẳng)
- `brow_length`, `brow_thickness`, `brow_eye_gap`

**Lớp 3 — Mũi**
- `nose_wing_width` (Bề rộng cánh mũi, vd 0.58)
- `nose_length`, `nose_bridge_width`, `nose_tip_ratio`

**Lớp 4 — Miệng & môi**
- `mouth_width` (Khoé miệng ngang, vd 0.66)
- `lip_thickness`, `lip_balance` (cân đối môi trên/dưới), `mouth_corner_angle`

> Trên **màn Quét** hiển thị live 4 chỉ số đại diện: Tỉ lệ dáng mặt, Độ cong cung mày, Bề rộng cánh mũi, Khoé miệng ngang. Kèm chỉ báo điều kiện chụp: `số điểm mốc / 478`, `fps`, `độ nghiêng đầu` (từ ma trận pose), `độ sáng đều %`. Chỉ cho "Chụp và phân tích" khi **đủ điều kiện chụp**.

`overlay.ts`: vẽ 4 lớp bóc tách chồng lên ảnh đã chụp (đường viền dáng mặt, 3 vạch tam đình, cung mày, cánh mũi, khoé miệng) — bật/tắt được (mockup có prop `showLandmarks`).

---

## 8. Bộ luật & nhóm nghề (dữ liệu — soạn từ sách)

Đây là phần tạo giá trị cốt lõi, soạn từ cuốn *Nhân Tướng Học* và các cổ thư. Nạp vào DB qua `seed`.

**6 nhóm nghề (`careers.json`)** — đúng thứ tự và % mẫu trong mockup:
1. Kỹ thuật & công nghệ — *Kỹ sư dữ liệu · lập trình viên · kỹ thuật viên vận hành hệ thống*
2. Tài chính, kế toán & kiểm toán — *Kiểm toán viên · chuyên viên tín dụng · kế toán tổng hợp*
3. Quản lý & vận hành — *Quản trị dự án · quản lý chất lượng · điều phối chuỗi cung ứng*
4. Nghiên cứu & giảng dạy — *Nghiên cứu viên · giảng viên · chuyên viên phân tích chính sách*
5. Pháp lý & hành chính công — *Chuyên viên pháp chế · thanh tra · quản lý hồ sơ nhà nước*
6. Kinh doanh & truyền thông — *Kinh doanh B2B · truyền thông thương hiệu · tư vấn khách hàng*

**Nguồn dẫn (`sources.json`)**: Nhân Tướng Học (sách của dự án), Ma Y Thần Tướng, Tướng pháp ngũ hình, Thần tướng toàn thư, Thái Thanh thần giám. Mọi luật phải trỏ về một nguồn có `citation` (quyển/trang) để hiện đúng như "*Ma Y Thần Tướng q.2*".

**Ví dụ luật (`rules.json`)** — theo đúng nội dung phiếu mẫu:
```json
[
  { "feature_key": "face_shape_ratio", "op": "category", "category": "kim",
    "trait": "Kiên định, bền chí", "reading_hint": "Xương mặt vuông, hàm rộng",
    "source": "Ma Y Thần Tướng", "citation": "q.2",
    "careers": { "ky-thuat-cong-nghe": 0.9, "quan-ly-van-hanh": 0.7, "phap-ly-hcc": 0.6 } },

  { "feature_key": "brow_curvature", "op": "lt", "v_max": 0.5,
    "trait": "Lý trí, thích quy tắc", "reading_hint": "Cung mày thẳng, ít cong",
    "source": "Tướng pháp ngũ hình", "citation": "tr.88",
    "careers": { "ky-thuat-cong-nghe": 0.8, "tai-chinh-ke-toan": 0.85 } },

  { "feature_key": "mouth_width", "op": "gt", "v_min": 0.6,
    "trait": "Giao tiếp cởi mở", "reading_hint": "Khoé miệng rộng, môi cân",
    "source": "Thần tướng toàn thư", "citation": "tr.140",
    "careers": { "kinh-doanh-truyen-thong": 0.85, "nghien-cuu-giang-day": 0.6 } },

  { "feature_key": "santing_middle", "op": "between", "v_min": 0.32, "v_max": 0.35,
    "trait": "Nhịp làm việc ổn định", "reading_hint": "Tam đình cân",
    "source": "Thái Thanh thần giám", "citation": "q.1",
    "careers": { "quan-ly-van-hanh": 0.8, "tai-chinh-ke-toan": 0.7 } }
]
```

---

## 9. Rules engine & chấm điểm nghề (`api/rules/engine.py`)

Deterministic, không dùng LLM:
1. Nhận vector 24 đặc trưng.
2. Duyệt toàn bộ `rules`, giữ những luật **khớp điều kiện** → tập "luật khớp" (mockup ghi "62 luật khớp").
3. Suy ra **archetype** từ `face_shape_ratio` + tam đình (vd "Mặt chữ Nhật — mẫu kim hình").
4. **Điểm mỗi nhóm nghề** = tổng có trọng số của (`rule.weight` × `rule_career_weights.weight`) trên các luật khớp, rồi chuẩn hoá về %.
   - Chuẩn hoá sao cho nhóm dẫn đầu ra khoảng 80–90% và phổ điểm giống mockup (86/81/74/70/64/58). Ghi rõ công thức chuẩn hoá trong code, đừng hard-code số.
5. Gom **nét tính cách + nguồn** từ các luật khớp mạnh nhất (khử trùng lặp theo `trait`) → tối đa ~4–6 thẻ trait cho phiếu.
6. Trả JSON (mục 10).

> Nếu chưa cắm LLM: sinh luận giải bằng **template** — nối các `reading_hint` của luật khớp mạnh nhất thành đoạn văn theo khung: "Khuôn mặt {archetype}… {hint1}… {hint2}… phù hợp các vai trò {mô tả nhóm nghề dẫn đầu}." Vẫn kèm đủ trích dẫn.

---

## 10. API (FastAPI)

```
POST /api/analyze
  body: { "features": { "face_shape_ratio": 0.72, "brow_curvature": 0.41, ... 24 số } }
  → 200: {
      "archetype": "Mặt chữ Nhật — mẫu kim hình",
      "matched_rules_count": 62,
      "traits": [
        { "label": "Kiên định, bền chí", "hint": "Xương mặt vuông, hàm rộng",
          "source": "Ma Y Thần Tướng", "citation": "q.2" }, ...
      ],
      "career_groups": [
        { "slug": "ky-thuat-cong-nghe", "name": "Kỹ thuật & công nghệ",
          "score": 86, "sample_jobs": "Kỹ sư dữ liệu · lập trình viên · ..." }, ...
      ],
      "reading": "Khuôn mặt chữ Nhật với hàm vững...",   // hoặc null nếu dùng stream
      "sources_count": 7
    }

POST /api/reading   (tùy chọn, SSE stream)   # sinh luận giải bằng RAG + LLM
GET  /api/careers                            # cho trang "Kho luận giải"
GET  /api/rules?feature=...                   # tra cứu luật + nguồn
```

**RAG + LLM (`api/rag` + `api/llm`)**: với mỗi archetype + trait khớp, truy hồi 3–5 đoạn `corpus_chunks` gần nhất (cosine), đưa vào prompt yêu cầu LLM viết đoạn luận giải tiếng Việt **chỉ dựa trên** luật khớp + đoạn truy hồi, giọng trung tính, không khẳng định như sự thật, và **không thêm nghề nào ngoài danh sách đã chấm điểm**. Trả kèm danh sách nguồn để hiển thị "N nguồn dẫn".

---

## 11. Chi tiết 4 màn (Definition of Done)

**01 · Trang chủ** — hero "Gương mặt bạn nói gì về nhóm nghề phù hợp?"; nút **Bắt đầu quét** (→ /scan) và **Xem một phiếu mẫu** (→ /result với dữ liệu mẫu); lưới 4 điểm: Camera trình duyệt / 478 điểm mốc / Bộ luật tướng học / RAG + LLM; **banner disclaimer** ở chân.

**02 · Quét gương mặt** — bật camera; khung căn mặt + hướng dẫn ("ánh sáng chính diện, bỏ kính, tóc không che cung mày, giữ 2 giây"); panel "Đặc trưng đang đọc" cập nhật live 4 chỉ số; chỉ báo `478/478 · fps · nghiêng đầu · sáng đều %` và trạng thái **đủ điều kiện chụp**; dòng "Chỉ 24 số liệu được gửi đi"; nút **Chụp và phân tích** + **Tải ảnh từ máy** (ảnh upload cũng xử lý on-device). DoD: gửi được vector 24 số sang /analyze, ảnh không rời client.

**03 · Đang phân tích** — 4 bước tuần tự có trạng thái ✓/đang chạy/○: *Chuẩn hoá 478 điểm mốc → Bóc tách 4 lớp · 24 chỉ số → Truy hồi luật khớp trong ngữ liệu → Sinh luận giải & bản đồ nhóm nghề*; ghi "trung bình 12 giây, có thể rời trang". DoD: phản ánh tiến trình gọi API thật (nếu stream thì cập nhật theo sự kiện).

**04 · Phiếu kết quả** — tiêu đề archetype + "N luật khớp, M nguồn dẫn"; badge **Nhóm nghề dẫn đầu** + %; khối ảnh đã chụp + lớp bóc tách (bật/tắt) với các nhãn đặc trưng (dáng mặt/tam đình/cung mày/cánh mũi/khoé miệng + giá trị); đoạn **Luận giải**; các **thẻ trait** kèm nguồn; **bảng 6 nhóm nghề** với thanh %; khối gợi ý "Nếu học tại Học viện Ngân hàng"; **disclaimer**; nút **Tải PDF** và **Quét lại**. DoD: render đúng từ JSON /analyze; nút Tải PDF xuất phiếu (in HTML→PDF phía client là đủ).

---

## 12. Thứ tự dựng (milestones)

1. Scaffold Next.js + FastAPI + MySQL, seed `careers/sources/rules`.
2. `landmarks.ts` + `features.ts`: bật camera, ra được vector 24 số + overlay. (Màn 02)
3. `rules/engine.py` + `POST /api/analyze` deterministic + template luận giải. (Màn 03, 04 với template)
4. Trang chủ + phiếu mẫu + Tải PDF + disclaimer khắp nơi. (Màn 01)
5. RAG + LLM cho luận giải tự nhiên, streaming. Trang "Kho luận giải" / "Về phương pháp".
6. Responsive, xử lý lỗi (không có camera, thiếu sáng, không thấy mặt), a11y.

Mỗi bước tự chạy được rồi hãy sang bước sau. Ưu tiên đúng luồng dữ liệu và ràng buộc riêng tư hơn là hoàn thiện hình thức.

---

## 13. Quy ước cho Claude Code

- Bám sát **design token mục 5** và mockup `design/face-career-app.html`; đừng tự đổi màu/font.
- Toàn bộ UI, nội dung, comment hướng người dùng bằng **tiếng Việt**.
- **Không** thêm bất kỳ đường gửi ảnh/khung hình nào lên server. Nếu một tính năng cần ảnh ở server, dừng lại và hỏi.
- Đặt các con số hiển thị (86%, 62 luật, 12s…) là **dữ liệu tính ra**, không hard-code trừ trang "phiếu mẫu".
- Giữ nguyên và hiển thị **disclaimer** ở màn 01 và 04, và câu "% là mức khớp, không phải dự báo thành công".
- Bí mật (khoá API LLM, MySQL) qua biến môi trường `.env`; không commit.
- Trước khi cài thư viện lạ, ưu tiên các gói trong stack đã chốt ở mục 3.
