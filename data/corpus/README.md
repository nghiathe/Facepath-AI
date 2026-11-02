# Ngữ liệu cổ thư (Hán văn gốc, public domain)

Bản thương mại **chỉ dùng nguồn công cộng**: nguyên văn Hán lấy từ Wikisource
(維基文庫), nhóm tự dịch và diễn giải. Không chép nội dung bản dịch *Nhân Tướng
Học* (Hy Trương) hay bản dịch hiện đại nào khác còn bản quyền.

Dựng lại: `python -I data/tools/fetch_corpus.py` (tải lại sẽ giữ bản dịch của
những đoạn có nguyên văn không đổi).

## Các sách

| File | Sách | Ghi chú |
|---|---|---|
| `bingjian.jsonl` | 冰鑑 (Băng Giám), 7 thiên | Wikisource ghi 羅祖真人; lời bạt chép "不著撰人姓名". Thường được gán cho Tăng Quốc Phiên nhưng **chưa chắc** — đừng ghi tác giả như sự thật. Hợp nhất với tính cách (thần, cốt, tình thái). |
| `xiangshu.jsonl` | 古今圖書集成 · 藝術典 · 相術部 | Phần lớn là 神相全編 (Thần tướng toàn biên), q.645–646 là 照膽經 (Chiếu đảm kinh), kèm 相兒經, 人相篇... Nguyên văn gồm cả chú giải xen kẽ. |

Có thể thêm sau: 柳莊相法, 太清神鑑, 月波洞中記 (kiểm tra bản trên Wikisource/ctext trước).

## Mỗi dòng = một đoạn

| Trường | Ý nghĩa |
|---|---|
| `id` | `<sách>.<thiên>.<đoạn>`. Ổn định chừng nào `revid` không đổi. Luật trỏ vào đây qua `passage_ids`. |
| `book`, `volume`, `section` | Tên sách, quyển (với 圖書集成), tên thiên. |
| `han` | Nguyên văn đã bỏ khoảng trắng. `quote_han` của luật phải là chuỗi con của trường này. |
| `url`, `revid` | Link tới đúng phiên bản trang (oldid) để người đọc tra lại. |
| `vi` | Bản dịch tiếng Việt của nhóm. |
| `han_viet` | Phiên âm Hán Việt (tuỳ chọn). |
| `translator` | Ai dịch. Bản nháp do máy dịch phải ghi rõ, ví dụ `"Claude (nháp)"`. |
| `reviewed_by` | Người đọc được Hán văn đã duyệt bản dịch. Chưa duyệt thì để `null`, và phiếu trả phí không được dùng đoạn đó. |

## Lưu ý khi soạn luật từ ngữ liệu
- Đa số câu trong cổ thư nói về **phú quý / thọ yểu / hôn nhân**. Bản thương mại chỉ
  lấy những câu nói về **tính cách, năng lực, tác phong** (`validate_data.py` sẽ chặn).
- Bộ vị phải đo được bằng FaceMesh. Tay, chân, giọng nói, khí sắc, râu, tai, chân tóc
  thì không đo được.
- Luật do nhóm suy ra (sách không nói thẳng) ghi `confidence: "suy_luan"`.
