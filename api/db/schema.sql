-- DDL theo CLAUDE.md mục 6.
-- Bổ sung duy nhất so với bản trong CLAUDE.md: utf8mb4 / utf8mb4_unicode_ci.
-- Thiếu phần này thì tiếng Việt có dấu lưu vào sẽ hỏng thành '???'.
-- KHÔNG bảng nào chứa ảnh: server chỉ nhận vector số (mục 1 + 13).

CREATE TABLE IF NOT EXISTS sources (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  title        VARCHAR(255) NOT NULL,      -- vd "Ma Y Thần Tướng"
  citation     VARCHAR(255),               -- vd "q.2" / "tr.88"
  note         TEXT
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS traits (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  label        VARCHAR(120) NOT NULL,      -- vd "Kiên định, bền chí"
  description  TEXT
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS career_groups (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  slug         VARCHAR(80) UNIQUE NOT NULL,
  name         VARCHAR(120) NOT NULL,      -- vd "Kỹ thuật & công nghệ"
  sample_jobs  TEXT,                       -- vd "Kỹ sư dữ liệu · lập trình viên · ..."
  sort_order   INT DEFAULT 0
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Một "luật" = một điều kiện trên 1 đặc trưng -> suy ra 1 nét tính cách, có nguồn
CREATE TABLE IF NOT EXISTS rules (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  feature_key  VARCHAR(60) NOT NULL,       -- vd "brow_curvature" (mục 7)
  op           ENUM('lt','lte','gt','gte','between','category') NOT NULL,
  v_min        FLOAT,                      -- ngưỡng / cận dưới
  v_max        FLOAT,                      -- cận trên (cho 'between')
  category     VARCHAR(60),                -- cho op='category' (vd face_shape='kim')
  trait_id     INT NOT NULL,
  source_id    INT NOT NULL,
  reading_hint VARCHAR(255),               -- mảnh câu để LLM/template dùng
  weight       FLOAT DEFAULT 1.0,
  FOREIGN KEY (trait_id)  REFERENCES traits(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mỗi luật đóng góp điểm cho một hoặc nhiều nhóm nghề
CREATE TABLE IF NOT EXISTS rule_career_weights (
  rule_id          INT NOT NULL,
  career_group_id  INT NOT NULL,
  weight           FLOAT NOT NULL,          -- 0..1
  PRIMARY KEY (rule_id, career_group_id),
  FOREIGN KEY (rule_id) REFERENCES rules(id),
  FOREIGN KEY (career_group_id) REFERENCES career_groups(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ngữ liệu cổ thư cho RAG (mốc 5)
CREATE TABLE IF NOT EXISTS corpus_chunks (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  source_id    INT NOT NULL,
  content      TEXT NOT NULL,
  embedding    JSON,                        -- mảng float (hoặc lưu file .npy riêng)
  FOREIGN KEY (source_id) REFERENCES sources(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (Tuỳ chọn) lưu phiên để làm lịch sử — TUYỆT ĐỐI không lưu ảnh
CREATE TABLE IF NOT EXISTS sessions (
  id           CHAR(36) PRIMARY KEY,        -- uuid
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  archetype    VARCHAR(80),                 -- vd "kim hình - mặt chữ Nhật"
  features     JSON,                        -- vector chỉ số
  result       JSON                         -- kết quả đầy đủ để render lại
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
