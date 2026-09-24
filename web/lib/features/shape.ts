// Phân loại dáng mặt (ngũ hình) — bản v4, thay cho ngưỡng cứng cũ.
//
// Port của data/lib/shapeClassifier.ts vào web/, giữ nguyên công thức; phần
// thay đổi chỉ là kiểu dữ liệu và chỗ lấy chỉ số điểm mốc (landmark-ids.ts).
//
// VÌ SAO PHẢI ĐỔI (data/README.md, mục "Bản v4"): cách cũ đọc thẳng
// faceW/faceH và jawW/cheekW rồi so với ngưỡng tuyệt đối. Trên chính khuôn mặt
// trung bình của MediaPipe, trán chỉ rộng 0.82 và hàm 0.78 so với gò má — đọc
// theo nghĩa đen "trán rộng, cằm thon" thì gần như ai cũng ra Mộc hoặc Hỏa.
//
// Cách làm mới, ba bước:
//   1. Đo bề ngang 5 tầng (trán, thái dương, gò má, hàm, cằm) + dài mặt + độ
//      "đầy" của đường viền + góc hàm, sau khi đã khử nghiêng đầu.
//   2. Quy về z-score theo phân phối quần thể (calib_shape.json) — so với
//      NGƯỜI KHÁC chứ không so với một con số tuyệt đối.
//   3. So khớp mềm với `prototype` của từng hành trong face_types.json, ra xác
//      suất; cho phép kiêm hình ("Kim kiêm Thổ").
//
// LƯU Ý ĐƠN VỊ: mọi hàm ở đây nhận TOẠ ĐỘ PIXEL (đã nhân x với bề ngang khung,
// y với bề cao khung). Dùng thẳng toạ độ chuẩn hoá [0,1] của MediaPipe sẽ làm
// méo tỉ lệ ngang/dọc theo khung hình: webcam 16:9 ép bề ngang lại, khuôn mặt
// nào cũng hoá ra "dài" — đúng cái lỗi mà bản v4 đi sửa.

import calibJson from "../../../data/data-train/calib_shape.json";
import { FACE_OVAL_ORDERED, SHAPE_PT as S, PT } from "./landmark-ids";
import type { Landmark } from "./types";

// --- Hiệu chuẩn -------------------------------------------------------------

export type CalibEntry = { mean: number; std: number };

/**
 * Mean/std của quần thể để tính z-score.
 *
 * TẠM: bản đang dùng lấy mean từ canonical_face_model của MediaPipe, std là
 * ước lượng (xem trường `_status` trong file). Phải thay bằng output của
 * data/tools/calibrate.py chạy trên >= 150 lượt quét thật trước khi tin con số
 * "Kim/Mộc/Thuỷ..." ở phiếu.
 */
export const CALIB_SHAPE: Record<string, CalibEntry> = Object.fromEntries(
  Object.entries(calibJson as Record<string, unknown>).filter(
    (e): e is [string, CalibEntry] =>
      !e[0].startsWith("_") &&
      typeof e[1] === "object" &&
      e[1] !== null &&
      "mean" in e[1]
  )
);

/** true khi calib vẫn là số tạm — dùng để hạ cờ tin cậy ở phiếu. */
export const CALIB_IS_PROVISIONAL = String(
  (calibJson as { _status?: string })._status ?? ""
)
  .toUpperCase()
  .includes("PROVISIONAL");

// --- Ngưỡng tư thế ----------------------------------------------------------

/** Quay ngang quá mức làm hẹp một bên mặt → kết quả lệch về Mộc/Hỏa. */
export const YAW_LIMIT = 0.12;

/** Hai khoé mắt ngoài gần nhau quá thì nhiễu điểm mốc lấn át phép đo. */
export const MIN_EYE_SPAN_PX = 90;

// --- Hình học cơ bản --------------------------------------------------------

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const cos =
    (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Diện tích đa giác (công thức shoelace) — cần điểm theo đúng thứ tự contour. */
function polygonArea(pts: Landmark[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

/** Xoay mọi điểm để đường nối hai khoé mắt ngoài nằm ngang (khử nghiêng đầu). */
export function deRoll(lm: Landmark[]): Landmark[] {
  const a = lm[PT.EYE_R_OUTER];
  const b = lm[PT.EYE_L_OUTER];
  const th = -Math.atan2(b.y - a.y, b.x - a.x);
  const c = Math.cos(th);
  const s = Math.sin(th);
  return lm.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }));
}

/** Đổi điểm mốc chuẩn hoá [0,1] của MediaPipe sang pixel của khung hình. */
export const toPixels = (
  lm: Landmark[],
  frame: { width: number; height: number }
): Landmark[] =>
  lm.map((p) => ({ x: p.x * frame.width, y: p.y * frame.height, z: p.z }));

// --- Phép đo ----------------------------------------------------------------

/**
 * Bảy số tả dáng mặt. Bốn bề ngang đầu chia cho bề ngang gò má, nên bất biến
 * với kích thước ảnh; `length` cũng chia cho gò má nên là tỉ lệ dài/rộng.
 */
export type ShapeRaw = {
  fh: number; // bề ngang trán
  temple: number; // bề ngang thái dương
  jaw: number; // bề ngang góc hàm
  chin: number; // bề ngang cằm
  length: number; // dài mặt / ngang gò má
  round: number; // diện tích viền / diện tích bbox — 1 = chữ nhật đặc, nhỏ = thon
  jaw_angle: number; // độ, góc ở góc hàm; nhỏ = hàm vuông
};

/** Các số đo phụ, dùng cho luật cheekbone_height / brow_kiem và cho 12 Chi. */
export type ShapeExtra = {
  cheekbone_height: number; // > 0 = quyền cao hơn trung điểm Sơn Căn–Chuẩn Đầu
  brow_tail_rise: number; // > 0 = đuôi mày ngược lên
  brow_gap: number; // khoảng cách hai đầu mày / bề ngang mắt
  eye_tilt: number; // > 0 = đuôi mắt xếch lên
};

/** Vì sao phép đo dáng mặt không đáng tin, null = đo được. */
export type ShapeReject = "yaw" | "too_small" | null;

export type ShapeMeasured = {
  shape: ShapeRaw;
  extra: ShapeExtra;
  yaw: number;
  eyeSpanPx: number;
  /**
   * Số đo LUÔN được trả về, kể cả khi bị từ chối — phía gọi vẫn cần chúng để
   * hiện chỉ báo live trên màn Quét. Nhưng `reason !== null` thì không được
   * trình bày kết quả ngũ hình như một kết luận.
   */
  reason: ShapeReject;
};

/**
 * Đo dáng mặt từ điểm mốc PIXEL.
 *
 * CHÂN TÓC: lưới MediaPipe dừng ở giữa trán, không tới chân tóc, nên `fh` là
 * bề ngang trán ĐO ĐƯỢC chứ không phải bề ngang trán thật của tướng học. Vì
 * vậy nó được so bằng z-score với chính phép đo ấy trên người khác, chứ không
 * so với mô tả "trán rộng" trong sách.
 */
export function measureShape(lmPx: Landmark[]): ShapeMeasured {
  const lm = deRoll(lmPx);
  const ck = dist(lm[S.CHEEK_L], lm[S.CHEEK_R]);
  const nose = lm[PT.NOSE_TIP];
  const eyeSpanPx = dist(lm[PT.EYE_R_OUTER], lm[PT.EYE_L_OUTER]);

  // Mũi lệch về một bên gò má => đầu đang quay ngang.
  const yaw = ck === 0 ? 0 : (dist(nose, lm[S.CHEEK_L]) - dist(nose, lm[S.CHEEK_R])) / ck;
  const reason: ShapeReject =
    Math.abs(yaw) > YAW_LIMIT
      ? "yaw"
      : eyeSpanPx < MIN_EYE_SPAN_PX
        ? "too_small"
        : null;

  const oval = FACE_OVAL_ORDERED.map((i) => lm[i]);
  const xs = oval.map((p) => p.x);
  const ys = oval.map((p) => p.y);
  const bbox =
    (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));

  const shape: ShapeRaw = {
    fh: dist(lm[S.FOREHEAD_L], lm[S.FOREHEAD_R]) / ck,
    temple: dist(lm[S.TEMPLE_L], lm[S.TEMPLE_R]) / ck,
    jaw: dist(lm[S.JAW_L], lm[S.JAW_R]) / ck,
    chin: dist(lm[S.CHIN_L], lm[S.CHIN_R]) / ck,
    length: dist(lm[PT.FOREHEAD_TOP], lm[PT.CHIN_BOTTOM]) / ck,
    round: bbox === 0 ? 0 : polygonArea(oval) / bbox,
    jaw_angle:
      (angleAt(lm[S.CHEEK_L], lm[S.JAW_L], lm[PT.CHIN_BOTTOM]) +
        angleAt(lm[S.CHEEK_R], lm[S.JAW_R], lm[PT.CHIN_BOTTOM])) /
      2,
  };

  // y hướng xuống dưới, nên hiệu (dưới - trên) dương nghĩa là "cao hơn".
  const eyeW =
    (dist(lm[PT.EYE_R_OUTER], lm[PT.EYE_R_INNER]) +
      dist(lm[PT.EYE_L_OUTER], lm[PT.EYE_L_INNER])) /
    2;
  const noseMidY = (lm[PT.NASION].y + lm[PT.NOSE_TIP].y) / 2;
  const noseLen = dist(lm[PT.NASION], lm[PT.NOSE_TIP]) || 1;
  const malarY = (lm[S.MALAR_L].y + lm[S.MALAR_R].y) / 2;
  const w = eyeW || 1;

  const extra: ShapeExtra = {
    cheekbone_height: (noseMidY - malarY) / noseLen,
    brow_tail_rise:
      (lm[S.BROW_HEAD_L].y -
        lm[S.BROW_TAIL_L].y +
        (lm[S.BROW_HEAD_R].y - lm[S.BROW_TAIL_R].y)) /
      2 /
      w,
    brow_gap: dist(lm[S.BROW_HEAD_L], lm[S.BROW_HEAD_R]) / w,
    eye_tilt:
      (lm[PT.EYE_R_INNER].y -
        lm[PT.EYE_R_OUTER].y +
        (lm[PT.EYE_L_INNER].y - lm[PT.EYE_L_OUTER].y)) /
      2 /
      w,
  };

  return { shape, extra, yaw, eyeSpanPx, reason };
}

// --- Chuẩn hoá --------------------------------------------------------------

/** Quy các số đo thô về z-score. Chiều nào thiếu calib thì bỏ qua, không đoán. */
export function toZ(
  raw: Record<string, number>,
  calib: Record<string, CalibEntry> = CALIB_SHAPE
): Record<string, number> {
  const z: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const c = calib[k];
    if (c && c.std > 0 && Number.isFinite(v)) z[k] = (v - c.mean) / c.std;
  }
  return z;
}

// --- So khớp mềm ------------------------------------------------------------

export type Proto = {
  key: string;
  prototype: Record<string, number>;
  required?: string[];
};

export type Scored = { key: string; p: number };

/**
 * Khoảng cách bình phương trung bình tới từng prototype, chỉ tính trên các
 * chiều ĐO ĐƯỢC — thiếu một chiều thì bỏ qua chứ không phạt. Kết quả đưa qua
 * softmax thành xác suất, nên tổng luôn bằng 1.
 */
export function softMatch(
  z: Record<string, number>,
  protos: Proto[],
  temperature = 0.5
): Scored[] {
  const s = protos.map((pr) => {
    if (pr.required?.some((k) => !(k in z))) return -Infinity;
    const all = Object.keys(pr.prototype);
    const dims = all.filter((k) => k in z);
    // Quá ít chiều đo được thì so khớp vô nghĩa — loại hẳn mẫu đó.
    if (dims.length < 2 || dims.length < 0.6 * all.length) return -Infinity;
    const d =
      dims.reduce(
        (acc, k) =>
          acc + (Math.max(-3, Math.min(3, z[k])) - pr.prototype[k]) ** 2,
        0
      ) / dims.length;
    return -d;
  });

  const mx = Math.max(...s);
  if (!Number.isFinite(mx)) return protos.map((pr) => ({ key: pr.key, p: 0 }));
  const e = s.map((v) => (v === -Infinity ? 0 : Math.exp((v - mx) / temperature)));
  const sum = e.reduce((a, b) => a + b, 0) || 1;
  return protos
    .map((pr, i) => ({ key: pr.key, p: e[i] / sum }))
    .sort((a, b) => b.p - a.p);
}

/** p2 >= 70% p1 thì coi là kiêm hình, theo cách sách nói về "kiêm hình". */
export const KIEM_RATIO = 0.7;

/** Dưới mức này thì không hành nào trội rõ — phiếu phải nói là chưa chắc chắn. */
export const CONFIDENT_P = 0.35;

const HANH_NAME: Record<string, string> = {
  kim: "Kim",
  moc: "Mộc",
  thuy: "Thuỷ",
  hoa: "Hoả",
  tho: "Thổ",
};

export type HanhResult = {
  primary: string;
  /** Hành kiêm, null nếu một hành trội rõ. */
  secondary: string | null;
  membership: Scored[];
  /** vd "Kim" hoặc "Kim kiêm Thổ". */
  label: string;
  confident: boolean;
};

/** Gắn nhãn từ bảng xác suất đã có (dùng cả cho bản đã trộn với model). */
export function labelFromMembership(m: Scored[]): HanhResult {
  const [a, b] = m;
  const secondary = b && a && b.p >= KIEM_RATIO * a.p ? b.key : null;
  return {
    primary: a?.key ?? "tho",
    secondary,
    membership: m,
    confident: (a?.p ?? 0) >= CONFIDENT_P,
    label: secondary
      ? `${HANH_NAME[a.key]} kiêm ${HANH_NAME[secondary]}`
      : (HANH_NAME[a?.key] ?? "—"),
  };
}

export function classifyHanh(
  z: Record<string, number>,
  faceTypes: Proto[]
): HanhResult {
  return labelFromMembership(softMatch(z, faceTypes));
}

// --- Trộn với model faceshape (chưa bật) ------------------------------------

/** Thứ tự lớp đúng như class_to_idx lúc train (data/README.md). */
export const MODEL_CLASSES = [
  "Heart",
  "Oblong",
  "Oval",
  "Round",
  "Square",
] as const;

export type ProtoWithModel = Proto & { model_classes?: string[] };

/**
 * Trộn xác suất hình học với xác suất của model EfficientNet-B4.
 *
 * CHƯA DÙNG TRONG APP: repo không có file .onnx và chưa cài onnxruntime-web.
 * Giữ hàm ở đây để khi có trọng số thì chỉ việc gọi, và để phần cảnh báo trong
 * data/README.md có chỗ bám: model KHÔNG sinh ra trait, trích dẫn hay trọng số
 * nghề — nó chỉ là bằng chứng hình học phụ.
 *
 * - Mỗi lớp model chia đều cho các hành nhận nó (Heart, Oblong → Mộc; ...).
 * - Phần xác suất của lớp không ánh xạ (Oval) được chia lại theo chính phân bố
 *   hình học, nên Hoả/Thổ — model không có lớp tương ứng — không bị đè oan.
 * - alpha nhỏ: hình học vẫn là bên quyết định.
 */
export function fuseWithModel(
  geo: Scored[],
  modelProbs: number[],
  types: ProtoWithModel[],
  alpha = 0.3,
  minConf = 0.5
): { fused: Scored[]; usedModel: boolean } {
  if (
    modelProbs.length !== MODEL_CLASSES.length ||
    Math.max(...modelProbs) < minConf
  ) {
    return { fused: geo, usedModel: false };
  }

  const g = Object.fromEntries(geo.map((s) => [s.key, s.p]));
  const m = Object.fromEntries(types.map((t) => [t.key, 0]));
  let unmapped = 0;

  MODEL_CLASSES.forEach((c, i) => {
    const owners = types.filter((t) => t.model_classes?.includes(c));
    if (!owners.length) {
      unmapped += modelProbs[i];
      return;
    }
    for (const t of owners) m[t.key] += modelProbs[i] / owners.length;
  });
  for (const k in m) m[k] += unmapped * (g[k] ?? 0);

  const fused = types.map((t) => ({
    key: t.key,
    p: (1 - alpha) * (g[t.key] ?? 0) + alpha * m[t.key],
  }));
  const s = fused.reduce((a, b) => a + b.p, 0) || 1;
  return {
    fused: fused.map((f) => ({ key: f.key, p: f.p / s })).sort((a, b) => b.p - a.p),
    usedModel: true,
  };
}
