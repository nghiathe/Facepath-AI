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
- `rules.json` tăng từ 26 → 32 luật (mắt, trán, gò má).
- `rules_ear.json` (tách riêng, 2 luật tai): tai **không** có trong 478 điểm của MediaPipe FaceMesh, nên không tự chạy trong MVP. Mỗi luật có trường `requires`.
- Các luật `forehead_shape` có `requires` = cần phân loại hình trán từ chân tóc.

## Bản v4: sửa nhận diện hình mặt + thêm dữ liệu từ sách + model hỗ trợ

### Vấn đề
Hầu hết người dùng ra Mộc (trái lê ngược) hoặc Hỏa (trên thon dưới nở). Nguyên nhân nằm ở phép đo: lưới MediaPipe dừng giữa trán, không tới chân tóc và thái dương. Trên khuôn mặt trung bình của chính MediaPipe, trán chỉ rộng 0.82 và hàm 0.78 so với gò má. Đọc theo nghĩa đen ("trán rộng", "cằm thon") thì ai cũng "thon hai đầu".

### Cách sửa
1. **Đo lại** (`lib/shapeClassifier.ts`): bề ngang 5 tầng, dài mặt, độ vuông đường viền, góc hàm; khử nghiêng đầu; từ chối ảnh quay ngang hoặc chụp quá xa.
2. **So với quần thể**: z-score theo `calib_shape.json`. File này hiện là số **tạm**; chạy `tools/calibrate.py` trên dữ liệu thật.
3. **So khớp mềm**: mỗi hành có `prototype` trong `face_types.json`; kết quả là xác suất, cho phép kiêm hình ("Kim kiêm Thổ").
4. **Model hỗ trợ** (tuỳ chọn): EfficientNet-B4 train trên Kaggle FaceShape (xem mục dưới).

### Thay đổi trong từng file
| File | Thay đổi |
|---|---|
| `rules.json` | 32 → **35 luật**: thêm `cheekbone_high` (quyền cao, Tề Đông Giã), `dien_trach_narrow` (cung Điền trạch hẹp, Kiến Nông Cư Sĩ), `brow_kiem` (mày lưỡi kiếm, op `all`). Sửa `brow_high`: bỏ "phóng khoáng" (sách không nói vậy) → "Phúc khí, dễ hiển đạt". Sửa `cheekbone_prominent`: chỉ còn trích "quyền rộng" để không trùng `cheekbone_high`. Luật `face_*` thêm trường `evidence`. Mỗi luật sửa có `change_note`. |
| `face_types.json` | `trigger` viết lại thành tiêu chí đo được; thêm `prototype` (vector z) và `model_classes`. Hỏa/Thổ ghi rõ chỉ nhận diện bằng hình học. |
| `sources.json` | Thêm `vuong_van_khiet`, `kien_nong_cu_si`; thêm `model_faceshape_b4` với `type: "model"` và các cảnh báo. |
| `careers.json`, `rules_ear.json` | **Không đổi**: model không liên quan tới nhóm nghề, và không nhận diện tai. |
| `face_letters.json` (mới) | Thập đại tự hình tướng (Vương Văn Khiết): 9 hình, chỉ dùng làm nhãn hình học (`display_policy: "geometry_only"`) vì luận giải trong sách là vận mạng. Chữ Dụng bị loại, xem `face_letters_excluded.md`. |
| `archetypes_12chi.json` (mới) | Phân loại 12 Chi — sách nói lối này đặt nặng cá tính. 7 mẫu hiển thị, 4 mẫu ẩn; mục Hợi mất trong bản số hoá. |
| `calib_shape.json` (mới) | Mean/std để tính z-score. **Tạm**. |

### Model faceshape (Kaggle, EfficientNet-B4)
Theo notebook huấn luyện: 5 lớp theo thứ tự Heart, Oblong, Oval, Round, Square; ảnh chân dung nguyên khung được `Resize((224,224))` (không giữ tỉ lệ) và chuẩn hoá ImageNet; accuracy 0.849 ở epoch 17.

Ánh xạ sang ngũ hành: Square → Kim; Oblong, Heart → Mộc; Round → Thủy; Oval → không ánh xạ. **Không có lớp cho Hỏa và Thổ.**

Cách dùng trong app: `fuseWithModel()` trộn xác suất model vào kết quả hình học với trọng số 0.3, chỉ khi model tự tin ≥ 0.5. Phần xác suất của Oval được chia lại theo hình học, nên Hỏa/Thổ không bị đè oan. Model chạy trên trình duyệt (`lib/modelInference.ts`, onnxruntime-web) để ảnh vẫn không rời máy; xuất ONNX bằng `tools/export_onnx.py`.

#### Đã xuất ONNX (23/09/2026) — dùng fp16, KHÔNG dùng int8

```
.venv/bin/python data/tools/export_onnx.py data/best_model.pth --out web/public/models/faceshape_b4
```

| Bản | Cỡ | Δprob so với PyTorch | Kết luận |
|---|---|---|---|
| fp32 `faceshape_b4.onnx` | 67 MB | 0.00000 | đúng, giữ làm đối chứng (`data/faceshape_b4_fp32.onnx`) |
| **fp16 `faceshape_b4_fp16.onnx`** | **34 MB** | **0.0015** | **bản dùng cho web** — `web/public/models/` |
| int8 (`--int8`) | 17 MB | 0.755 | **HỎNG, không được dùng** |

Bản int8 do `quantize_dynamic` sinh ra **sập hẳn**: với mọi đầu vào thử (50 mẫu)
nó trả đúng một lớp `Round` với xác suất ~0.9. Nguyên nhân: lượng tử hoá động
biến mọi Conv thành ConvInteger và ước lượng dải activation theo từng tensor mà
không có calibration, trong khi EfficientNet dùng depthwise conv + SiLU có dải
rất rộng. Bật `per_channel=True` (cả QUInt8 lẫn QInt8) cũng không cứu được.
Muốn có int8 thật thì phải lượng tử hoá **tĩnh** (`quantize_static`) với vài trăm
ảnh chân dung thật làm calibration.

`export_onnx.py` nay tự kiểm trên 30 đầu vào và **thoát khác 0** nếu một bản nào
lệch quá ngưỡng hoặc sập về một lớp — nên không thể vô tình đem bản hỏng lên web.

Cả `best_model.pth` lẫn các file `.onnx` đều đã được `.gitignore` (quá nặng để
commit); dựng lại bằng đúng lệnh ở trên.

#### Đã nối vào app (23/09/2026)

| Nơi | Việc |
|---|---|
| `web/lib/features/model.ts` | nạp ort **động** (import tĩnh làm `next build` gãy ở bước prerender), wasm tự host ở `/onnxruntime/`, tiền xử lý đúng notebook |
| `web/lib/features/features.ts` | `applyModelFusion()` — gọi `fuseWithModel` rồi gắn lại nhãn ngũ hình |
| `web/app/analyze/page.tsx` | bước "Đối chiếu dáng mặt bằng model" ở màn 03, đo ~1.0 s thật trên Chrome |
| `web/app/result/page.tsx` | dòng ghi nguồn riêng cho model khi `usedModel` |
| `scripts/setup-assets.mjs` | copy wasm của onnxruntime (13.6 MB) cùng với wasm MediaPipe |

Đã chạy thử end-to-end bằng Chrome thật (Playwright) trên bản production:

- model chạy trong trình duyệt, `modelProbs` = `0.038 0.071 0.107 **0.735** 0.049`
  (Round) → Thuỷ tăng từ 0.056 lên 0.261, nhưng **Kim vẫn dẫn đầu** (0.438) vì
  alpha chỉ 0.3 — đúng ý "hình học vẫn quyết định";
- model dưới ngưỡng tự tin 0.5 thì `usedModel = false` và phân bố giữ nguyên;
- **không có request nào ra ngoài origin** — đúng ràng buộc ảnh không rời máy;
- thiếu file `.onnx` / WASM bị chặn thì bước đó ghi "model không nạp được — chỉ
  dùng hình học" và phiếu vẫn lập bình thường.

**Vẫn còn nợ**: phép thử ~50 ảnh webcam người Việt gán nhãn tay. Trước khi có
số đó, đừng coi phần model là đã kiểm chứng; tắt bằng
`NEXT_PUBLIC_FACESHAPE_MODEL=off`.

Cảnh báo — cần nêu trong báo cáo:
- Notebook dùng **chính tập test để chọn checkpoint** (best validation loss), nên 0.849 là ước lượng lạc quan. Không có số liệu theo từng lớp.
- Dữ liệu chủ yếu là ảnh người nổi tiếng phương Tây. Trước khi bật model, thử trên ~50 ảnh webcam người Việt đã gán nhãn tay; nếu đúng dưới ~60% thì để `alpha = 0`.
- Model **không** tạo ra hay sửa trait, trích dẫn, trọng số nghề. Nó chỉ là bằng chứng hình học phụ, và được ghi nguồn riêng.

### Hiệu chuẩn và kiểm thử
- `tools/calibrate.py scans.csv --out data/calib_shape.json --types data/face_types.json` — cần ≥150 lần quét (chỉ vector số, có đồng ý). Script báo nếu một hành chiếm >40%.
- `tools/fit_prototypes_from_model.py` — dùng model làm nhãn yếu trên một thư mục ảnh để **đề xuất** chỉnh `prototype` của Kim/Mộc/Thủy. Không ghi đè file; xuất đề xuất + bảng chéo hình học × model để người duyệt.
- `tools/smoke_test.ts` — biến dạng mặt trung bình MediaPipe; kéo dài → Mộc/Mục, ép ngắn → Thủy/Viên, hàm nở trán hẹp → Hỏa/Do, dạng thoi → chữ Thân, quay ngang → từ chối.

## Ghi chú quan trọng về tính trung thực của dữ liệu

Hai lớp thông tin có **độ tin cậy khác nhau**, cần phân biệt rõ trong UI:

1. **`trait` + `reading_hint` + `source` + `citation`** — lấy trực tiếp từ sách. Đây là phần kiểm chứng được: người dùng có thể tra lại đúng chương/mục.
2. **`careers` (trọng số nghề)** — là **lớp diễn giải do nhóm dự án thêm vào**. Sách cổ mô tả đặc điểm → *tính cách / phú quý bần tiện*, chỉ đôi chỗ nói thẳng tới nghề (ví dụ *miệng vòng cung* → “văn học, nghiên cứu”; *mày cọp* → “nghề cạnh tranh, thực nghiệp gia”; *cánh mũi cân xứng* → “khéo léo về kỹ thuật”). Các trọng số còn lại được suy từ tính cách sang 6 nhóm nghề hiện đại theo logic ngũ thường (Kim–Nghĩa, Mộc–Nhân, Thủy–Trí, Hỏa–Lễ, Thổ–Tín). **Không nên trình bày phần này như kết luận của cổ thư.**

3. **`face_letters.json` → `mapping_source`**: `"sach"` khi sách nối trực tiếp hình đó với ngũ hành, `"suy_luan"` khi do nhóm suy ra.
4. **`model_classes` / `fuseWithModel`**: bằng chứng từ model máy học, không phải từ sách.

Vì vậy phiếu kết quả nên: trích dẫn nguồn cho *trait*, còn phần % nghề giữ đúng nhãn “mức khớp giữa đặc điểm đọc được và mô tả trong ngữ liệu”, không phải dự báo thành công — như disclaimer đã quy định.

## Cách mở rộng
- Thêm luật: copy một object trong `rules.json`, đổi `feature_key`/ngưỡng/`trait`/`careers`, và **bắt buộc** điền `source` + `citation` trỏ về đúng chỗ trong sách.
- Sách còn nhiều bộ vị chưa khai thác (Mắt, Tai, Trán, Lưỡng Quyền, Nhân Trung, Pháp Lệnh, Ngũ Nhạc...). Có thể bổ sung dần khi thêm feature_key tương ứng ở `features.ts`.
- Với RAG: nạp toàn văn từng chương vào `corpus_chunks` để LLM viết luận giải bám sát, còn điểm số nghề vẫn do rules engine tính (deterministic).
