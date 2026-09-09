# design/

Mockup hiện hành: **`itde-tech-camp.html`** (thay cho `face-career-app.html` đã bỏ).

File đó là bản bundle **tự giải nén**, có nhúng sẵn font và ảnh (~740KB). Markup
thật không nằm trực tiếp trong file mà trong thẻ `<script type="__bundler/template">`
dưới dạng chuỗi JSON. Đọc nó bằng:

```bash
node -e "const fs=require('fs');const l=fs.readFileSync('design/itde-tech-camp.html','utf8').split('\n');fs.writeFileSync('/tmp/mockup.html',JSON.parse(l[381]))"
```

Bốn màn nằm trong các thẻ có `data-screen-label`: 01 Landing · 02 Đang quét ·
03 Kết quả · 04 Chi tiết kết quả. Landing và Kết quả nền **sáng**; hai màn còn
lại nền **tối** — xem bảng ở `CLAUDE.md` mục 5.

`CLAUDE.md` mục 4 ghi rõ: **mockup là tham chiếu, không sửa**. Mọi thay đổi giao
diện làm ở `/web`, còn file này giữ nguyên để đối chiếu.

Design token đã được trích sang `web/app/globals.css` (khối `@theme`), lấy đúng
giá trị trong `CLAUDE.md` mục 5.
