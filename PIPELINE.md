# PIPELINE.md — Ảnh → Feature → Rule Engine → Trait → Career

> Paste cả file này cho Claude Code (hoặc để ở repo root cạnh `CLAUDE.md`).
> Đọc kèm `CLAUDE.md` và thư mục `data/` (`rules.json`, `careers.json`, `face_types.json`, `sources.json`).
> Mục tiêu của lượt này: hiện thực **bước 1–4** (features → rule engine → traits → career scoring). RIASEC/fusion để interface sẵn, làm sau.

## 0. Ràng buộc không đổi (nhắc lại)
- Ảnh **không rời thiết bị**. `features.ts` chạy client; chỉ object số `FaceFeatures` được gửi/dùng tiếp.
- Mọi trait hiển thị phải **truy được về luật + nguồn** (không để LLM tự bịa). Đó là lý do rule engine phải giữ `rule_id`, `source`, `citation`.
- Điểm nghề gắn nhãn **"% mức khớp đặc điểm"**, KHÔNG phải "% khả năng làm nghề X".

---

## 1. Nguồn sự thật của schema = `rules.json`
Engine phải chạy được với đúng 14 `feature_key` mà 26 luật đang dùng. Đây là danh sách chốt (đừng đổi tên nếu chưa sửa `rules.json`):

| feature_key | kiểu | op dùng trong rules |
|---|---|---|
| `face_shape` | category (`kim`/`moc`/`thuy`/`hoa`/`tho`) | category |
| `santing_upper` | number 0..1 | gte |
| `santing_lower` | number 0..1 | gte |
| `santing_balance` | number 0..1 (1 = cân) | gte |
| `brow_curvature` | number 0..1 (0 = thẳng) | lt / gte |
| `brow_length` | number (~tỉ lệ so với mắt, 1.0 = bằng mắt) | gt / lt |
| `brow_thickness` | number 0..1 | gt |
| `brow_eye_gap` | number 0..1 | gt |
| `nose_wing_width` | number 0..1 | gte / between / lt |
| `nose_bridge_width` | number 0..1 | gte |
| `mouth_corner_angle` | number (âm = cụp, dương = hếch) | gt |
| `mouth_width` | number 0..1 | gt |
| `lip_thickness` | number 0..1 | lt / gte |
| `mouth_shape` | category (`vong_cung`/`ho`/`long`/`chu_tu`/…) | category |

Ops cần support: `lt, lte, gt, gte, between, category`.

---

## 2. `FaceFeatures` — schema chuẩn (đã hoà giải với bản nháp)
Bản nháp trước dùng `eyebrows.angle`, `nose.width`, `santing.balance` là enum → **không khớp** với `rules.json`. Dùng bản dưới đây làm chuẩn:

```ts
// lib/features/types.ts
export type FaceType = "kim" | "moc" | "thuy" | "hoa" | "tho";
export type MouthShape = "vong_cung" | "ho" | "long" | "chu_tu" | "khac";

export type FaceFeatures = {
  faceType: FaceType;                 // → feature_key face_shape

  santing: {
    upper: number;                    // 0..1, phần trán / tổng cao mặt
    middle: number;                   // 0..1 (tính để hiển thị, rules chưa dùng)
    lower: number;                    // 0..1, phần cằm
    balance: number;                  // 0..1, 1 = cân (33/34/33)
    dominant: "upper" | "middle" | "lower" | "balanced"; // chỉ để hiển thị
  };

  eyebrows: {
    curvature: number;                // 0..1, 0 = thẳng   → brow_curvature
    length: number;                   // ~tỉ lệ so mắt      → brow_length
    thickness: number;                // 0..1               → brow_thickness
    eyeGap: number;                   // 0..1               → brow_eye_gap
  };

  nose: {
    wingWidth: number;                // 0..1               → nose_wing_width
    bridgeWidth: number;              // 0..1               → nose_bridge_width
    length: number;                   // 0..1 (dự phòng)
  };

  mouth: {
    width: number;                    // 0..1               → mouth_width
    thickness: number;                // 0..1, độ dày môi   → lip_thickness
    cornerAngle: number;              // -1..1, hếch/cụp     → mouth_corner_angle
    shape: MouthShape;                // → mouth_shape
  };

  quality: {                          // để màn Scan quyết định "đủ điều kiện chụp"
    landmarks: number;                // số điểm nhận được / 478
    headTiltDeg: number;
    brightness: number;               // 0..1
    ok: boolean;
  };
};
```

**Khác biệt so với bản nháp — nhớ áp dụng:** `curvature` (không phải `angle`); thêm `eyeGap`; mũi tách `wingWidth` + `bridgeWidth`; `santing.balance` là **number** (kèm `dominant` để hiển thị); môi dùng `thickness` (ánh xạ `lip_thickness`) + `cornerAngle` + `shape`.

---

## 3. Bảng ánh xạ feature_key → giá trị (dùng trong rule engine)
Rule engine không nên biết cấu trúc lồng nhau. Định nghĩa một accessor phẳng:

```ts
// lib/engine/accessors.ts
import { FaceFeatures } from "../features/types";

export const NUMERIC: Record<string, (f: FaceFeatures) => number> = {
  santing_upper:     f => f.santing.upper,
  santing_lower:     f => f.santing.lower,
  santing_balance:   f => f.santing.balance,
  brow_curvature:    f => f.eyebrows.curvature,
  brow_length:       f => f.eyebrows.length,
  brow_thickness:    f => f.eyebrows.thickness,
  brow_eye_gap:      f => f.eyebrows.eyeGap,
  nose_wing_width:   f => f.nose.wingWidth,
  nose_bridge_width: f => f.nose.bridgeWidth,
  mouth_corner_angle:f => f.mouth.cornerAngle,
  mouth_width:       f => f.mouth.width,
  lip_thickness:     f => f.mouth.thickness,
};

export const CATEGORICAL: Record<string, (f: FaceFeatures) => string> = {
  face_shape:  f => f.faceType,
  mouth_shape: f => f.mouth.shape,
};
```

---

## 4. `features.ts` — trích đặc trưng từ landmarks
Dùng **MediaPipe Face Landmarker** (478 điểm). Mốc chuẩn hoá: **khoảng cách hai khoé mắt ngoài** (inter-ocular distance, `iod`) — chia mọi kích thước cho `iod` để bất biến với khoảng cách camera. Dùng các nhóm điểm có sẵn của MediaPipe (`FACEMESH_FACE_OVAL`, `FACEMESH_LEFT/RIGHT_EYE`, `FACEMESH_LEFT/RIGHT_EYEBROW`, `FACEMESH_LIPS`, `FACEMESH_NOSE`) thay vì gõ tay chỉ số; nếu cần điểm đơn lẻ, xác minh index rồi khai báo hằng số ở một chỗ (`landmark-ids.ts`).

### 4.1 Bảng công thức (tất cả normalize về khoảng ghi ở cột phải)
| Trường | Đo thô | Chuẩn hoá về |
|---|---|---|
| faceWidth | bề ngang gò má (zygomatic) / iod | — |
| faceHeight | đỉnh trán (điểm oval trên) – cằm (điểm oval dưới) / iod | — |
| `santing.upper` | (chân tóc→giữa mày) / faceHeight | tỉ lệ, Σ3 ≈ 1 |
| `santing.middle` | (giữa mày→chân mũi) / faceHeight | " |
| `santing.lower` | (chân mũi→cằm) / faceHeight | " |
| `santing.balance` | `1 − (max\|third − 1/3\|) / (1/3)` | 0..1 |
| `eyebrows.curvature` | sagitta/chord của cung mày (độ vồng arc trên dây cung) | map → 0..1 |
| `eyebrows.length` | dài mày / dài mắt | ~1.0 là bằng mắt |
| `eyebrows.thickness` | dày mày / iod | map → 0..1 |
| `eyebrows.eyeGap` | (mép dưới mày → mí trên) / iod | map → 0..1 |
| `nose.wingWidth` | bề ngang cánh mũi / faceWidth | map → 0..1 |
| `nose.bridgeWidth` | bề ngang sống mũi / iod | map → 0..1 |
| `mouth.width` | bề ngang miệng / faceWidth | map → 0..1 |
| `mouth.thickness` | (dày môi trên + dưới) / iod | map → 0..1 |
| `mouth.cornerAngle` | góc khoé miệng so đường ngang (dương = hếch) | -1..1 |

"map → 0..1" nghĩa là clamp tuyến tính từ dải người thật hợp lý, ví dụ:
```ts
const norm = (x:number, lo:number, hi:number) => Math.max(0, Math.min(1, (x-lo)/(hi-lo)));
// ví dụ nose.wingWidth: norm(alaWidth/faceWidth, 0.25, 0.45)
```
Các cặp `(lo, hi)` để trong một object `CALIB` ở đầu file để dễ hiệu chỉnh (xem mục 10).

### 4.2 Phân loại `faceType` (ngũ hình)
Đọc `data/face_types.json` cột `trigger` làm mô tả. Logic tối thiểu cho MVP:
```ts
const r = faceWidth / faceHeight;              // vuông/tròn cao → r lớn
const jaw = jawWidth / cheekWidth;             // hàm rộng?
if (r >= 0.95 && jaw >= 0.9)          return "kim";   // vuông/chữ nhật, hàm rộng
if (r <= 0.80)                         return "moc";   // dài, thon
if (santing.upper < santing.lower-0.04) return "hoa";  // trên thon dưới nở
if (fullness >= 0.6 && r >= 0.85)     return "thuy";  // tròn đầy, nhiều thịt
return "tho";                                          // dày vững / còn lại
```
(`fullness` = ước lượng "đầy thịt" từ độ tròn của oval + má; MVP có thể xấp xỉ bằng r và độ cong contour.)

### 4.3 Phân loại `mouth.shape`
```ts
// vòng cung: rộng + môi mỏng + khoé hơi hếch
if (width > 0.62 && thickness < 0.45 && cornerAngle > 0.05) return "vong_cung";
// cọp: rất rộng, khoé rõ
if (width > 0.7)                                            return "ho";
// rồng: rộng trung bình, môi đầy vừa, cân xứng đẹp
if (width >= 0.5 && width <= 0.65 && thickness >= 0.45 && thickness <= 0.6) return "long";
// chữ tứ/vuông: cân xứng, môi dày vừa, khoé ngang
if (Math.abs(cornerAngle) < 0.05 && thickness >= 0.5)      return "chu_tu";
return "khac";
```

### 4.4 Unit test (bắt buộc cho 2 feature đặc biệt)
`features.test.ts`: dựng landmark giả (hoặc snapshot từ 3–4 ảnh mẫu) và assert:
- `santing.balance` = 1.0 khi ba tầng = 1/3; giảm dần khi lệch.
- `mouth.shape` trả đúng nhãn cho từng bộ (width, thickness, cornerAngle) biên.
- Bất biến tỉ lệ: nhân đôi toạ độ (phóng to ảnh) → mọi feature không đổi (vì đã chia iod).

---

## 5. `rule-engine.ts`
```ts
// lib/engine/rule-engine.ts
import { NUMERIC, CATEGORICAL } from "./accessors";
import type { FaceFeatures } from "../features/types";

export type Rule = {
  id: string; feature_key: string; op: "lt"|"lte"|"gt"|"gte"|"between"|"category";
  v_min?: number; v_max?: number; category?: string;
  trait: string; reading_hint: string; source: string; citation: string;
  weight: number; careers: Record<string, number>;
};
export type MatchedRule = Rule & { value: number | string };

export function evaluateRules(f: FaceFeatures, rules: Rule[]): MatchedRule[] {
  const out: MatchedRule[] = [];
  for (const r of rules) {
    if (r.op === "category") {
      const v = CATEGORICAL[r.feature_key]?.(f);
      if (v !== undefined && v === r.category) out.push({ ...r, value: v });
      continue;
    }
    const v = NUMERIC[r.feature_key]?.(f);
    if (v === undefined) continue;               // feature_key không có accessor → bỏ qua
    const ok =
      r.op === "lt"  ? v <  (r.v_max ?? Infinity) :
      r.op === "lte" ? v <= (r.v_max ?? Infinity) :
      r.op === "gt"  ? v >  (r.v_min ?? -Infinity) :
      r.op === "gte" ? v >= (r.v_min ?? -Infinity) :
      r.op === "between" ? v >= (r.v_min ?? -Infinity) && v <= (r.v_max ?? Infinity) :
      false;
    if (ok) out.push({ ...r, value: v });
  }
  return out;
}
```
Engine này **thuần, không phụ thuộc React**, để test dễ và có thể chạy cả ở client lẫn server.

---

## 6. Trait aggregation (cho màn Physiognomy)
Gom `MatchedRule[]` theo `trait`; mỗi trait giữ danh sách luật + nguồn để click "Xem nguồn".
```ts
export type Trait = {
  slug: string; label: string;        // label = giá trị `trait` tiếng Việt trong rules
  score: number;                       // 0..1
  rules: { id: string; hint: string; source: string; citation: string }[];
};
```
- `slug = slugify(label)`.
- `score` = `Σ weight (luật đã khớp của trait) / Σ weight (TẤT CẢ luật cùng trait trong rules.json)` — "tín hiệu của nét này đã kích hoạt bao nhiêu phần". Bound 0..1, ổn định.
- Sắp xếp giảm dần theo score, hiển thị top ~4–6 (như mockup: Lý trí 82 / Kiên định 76 / Giao tiếp 71 / Kỹ thuật 68). Icon: map tuỳ chọn cho vài trait chính, còn lại để icon mặc định.

---

## 7. Career scoring (deterministic, chưa ML)
```ts
export type CareerScore = { slug: string; name: string; percent: number; sample_jobs: string };

export function scoreCareers(matched: MatchedRule[], allRules: Rule[], careers: Career[]): CareerScore[] {
  const raw: Record<string, number> = {};
  const maxAttain: Record<string, number> = {};
  for (const c of careers) { raw[c.slug] = 0; maxAttain[c.slug] = 0; }

  for (const r of allRules)                       // mẫu số: tổng tín hiệu có thể có cho từng nghề
    for (const [slug, w] of Object.entries(r.careers)) maxAttain[slug] += r.weight * w;
  for (const r of matched)                        // tử số: tín hiệu đã khớp
    for (const [slug, w] of Object.entries(r.careers)) raw[slug] += r.weight * w;

  return careers
    .map(c => ({
      slug: c.slug, name: c.name, sample_jobs: c.sample_jobs,
      percent: maxAttain[c.slug] ? Math.round(100 * raw[c.slug] / maxAttain[c.slug]) : 0,
    }))
    .sort((a, b) => b.percent - a.percent);
}
```
- `percent` ở đây có nghĩa **rõ ràng và trung thực**: "bao nhiêu phần các đặc điểm mà ngữ liệu gắn với nhóm nghề này đã xuất hiện trên khuôn mặt" — đúng nhãn **"% mức khớp đặc điểm"**.
- Con số 86/81/74… trong mockup chỉ là minh hoạ; số thật do công thức này sinh ra.
- Caveat: nhóm nghề có ít luật trỏ tới dễ bị nhiễu. Đặt ngưỡng tối thiểu (vd cần ≥2 luật khớp mới hiển thị %) hoặc pha thêm hệ số theo số tín hiệu — ghi TODO, chưa cần cho MVP.

---

## 8. RIASEC + Fusion (interface sẵn, làm sau MVP)
Chưa hiện thực, nhưng khai báo trước để không phải sửa kiến trúc:
```ts
export type Assessment = {
  physiognomy: CareerScore[];   // từ mục 7
  riasec?: CareerScore[];       // từ bộ câu hỏi RIASEC
  skills?: CareerScore[];
  preferences?: CareerScore[];
};
export const FUSION_WEIGHTS = { physiognomy: 0.3, riasec: 0.4, skills: 0.2, preferences: 0.1 };
// fuse(): tổng có trọng số theo slug rồi normalize; nếu chỉ có physiognomy thì trả nguyên nó.
```

---

## 9. Cấu trúc file & thứ tự làm
```
lib/
  features/
    types.ts            # FaceFeatures
    landmark-ids.ts     # hằng số nhóm điểm MediaPipe
    features.ts         # landmarks → FaceFeatures  (mục 4)
    features.test.ts    # (mục 4.4)
  engine/
    accessors.ts        # mục 3
    rule-engine.ts      # mục 5
    traits.ts           # mục 6
    career.ts           # mục 7
    engine.test.ts
  data.ts               # load & type 4 file trong data/
```
Thứ tự: **types → features.ts (+test) → rule-engine (+test) → traits → career (+test)**. Mỗi bước xanh test rồi mới sang bước sau. Chưa đụng UI ở lượt này (UI đã có mockup, nối dây sau).

### Definition of Done cho lượt này
- `evaluateRules(sampleFeatures, rules)` trả về danh sách luật khớp, mỗi luật còn nguyên `id`, `source`, `citation`.
- `scoreCareers(...)` trả 6 nhóm nghề với `percent` 0..100, sort giảm dần.
- Test cho `santing.balance`, `mouth.shape`, tính bất biến tỉ lệ, và một ca end-to-end: `features → matched rules → traits → careers`.

---

## 10. Hiệu chỉnh ngưỡng (đọc kỹ — nếu bỏ qua sẽ ra kết quả lệch)
Các ngưỡng số trong `rules.json` (vd `nose_wing_width >= 0.6`) là **tạm tính**, chỉ đúng khi `features.ts` xuất ra cùng thang 0..1 như mô tả. Vì vậy:
1. Viết script `scripts/calibrate.ts`: chạy `features.ts` trên ~10–20 ảnh mẫu, in ra min/median/max của từng feature.
2. Chỉnh các cặp `(lo, hi)` trong `CALIB` để median rơi vào ~0.5 và dải phủ 0..1 hợp lý.
3. Sau đó rà lại ngưỡng trong `rules.json` cho khớp thực tế. Đây là việc bắt buộc trước khi tin vào con số %.
