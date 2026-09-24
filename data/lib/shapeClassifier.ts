/**
 * FacePath AI — phân loại hình khuôn mặt v3
 *
 * Thay cho cách cũ (ngưỡng cứng trên face_shape_ratio / jaw_width):
 *  1. Đo "profile bề ngang" 5 tầng (trán, thái dương, gò má, hàm, cằm) chuẩn hoá theo bề ngang gò má.
 *  2. Chuẩn hoá z-score theo phân phối quần thể (calib_shape.json) — KHÔNG so với con số tuyệt đối.
 *  3. So khớp mềm với prototype (face_types.json, face_letters.json) → xác suất, cho phép kiêm hình.
 *
 * Ảnh không rời máy: mọi hàm ở đây chạy trên landmark MediaPipe (478 điểm) tại client.
 */

export interface LM { x: number; y: number; z?: number }

/** Viền mặt theo thứ tự của MediaPipe FACE_OVAL. */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

const IDX = {
  top: 10, chin: 152,
  fhL: 54, fhR: 284,          // trán (mesh không tới chân tóc — xem estimateHairlineY)
  tmL: 21, tmR: 251,          // thái dương
  ckL: 234, ckR: 454,         // gò má (bizygomatic)
  jwL: 172, jwR: 397,         // góc hàm
  chL: 149, chR: 378,         // hai bên cằm
  nasion: 168, noseTip: 1,
  malarL: 117, malarR: 346,
  eyeOutL: 33, eyeInL: 133, eyeOutR: 263, eyeInR: 362,
  browHeadL: 55, browHeadR: 285, browTailL: 70, browTailR: 300,
} as const;

// ---------- hình học cơ bản (toạ độ pixel: nhân x với width, y với height trước khi gọi) ----------
const dist = (a: LM, b: LM) => Math.hypot(a.x - b.x, a.y - b.y);
function angleAt(a: LM, b: LM, c: LM): number {
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y;
  const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}
function polygonArea(pts: LM[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}
/** Xoay mọi điểm để đường nối hai khoé mắt ngoài nằm ngang (khử nghiêng đầu). */
function deRoll(lm: LM[]): LM[] {
  const a = lm[IDX.eyeOutL], b = lm[IDX.eyeOutR];
  const th = -Math.atan2(b.y - a.y, b.x - a.x);
  const c = Math.cos(th), s = Math.sin(th);
  return lm.map(p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }));
}

// ---------- đặc trưng ----------
export interface ShapeRaw {
  fh: number; temple: number; jaw: number; chin: number;
  length: number; round: number; jaw_angle: number;
}
export interface ExtraRaw {
  cheekbone_height: number; brow_tail_rise: number; brow_gap: number; eye_tilt: number;
  jaw_ratio: number; chin_ratio: number;
}
export type Extracted =
  | { ok: true; shape: ShapeRaw; extra: ExtraRaw; yaw: number }
  | { ok: false; reason: 'yaw' | 'too_small'; yaw: number };

/** Ngưỡng tư thế: quay ngang quá mức làm hẹp một bên mặt → lệch về Mộc/Hỏa. */
export const YAW_LIMIT = 0.12;
/** Khoảng cách hai khoé mắt ngoài tối thiểu (px) — chụp quá xa/nhỏ thì nhiễu lớn. */
export const MIN_EYE_SPAN_PX = 90;

export function extractFeatures(lmPx: LM[]): Extracted {
  const lm = deRoll(lmPx);
  const ck = dist(lm[IDX.ckL], lm[IDX.ckR]);
  const nose = lm[IDX.noseTip];
  const yaw = (dist(nose, lm[IDX.ckL]) - dist(nose, lm[IDX.ckR])) / ck;
  if (Math.abs(yaw) > YAW_LIMIT) return { ok: false, reason: 'yaw', yaw };
  if (dist(lm[IDX.eyeOutL], lm[IDX.eyeOutR]) < MIN_EYE_SPAN_PX) return { ok: false, reason: 'too_small', yaw };

  const oval = FACE_OVAL.map(i => lm[i]);
  const xs = oval.map(p => p.x), ys = oval.map(p => p.y);
  const bbox = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));

  const shape: ShapeRaw = {
    fh: dist(lm[IDX.fhL], lm[IDX.fhR]) / ck,
    temple: dist(lm[IDX.tmL], lm[IDX.tmR]) / ck,
    jaw: dist(lm[IDX.jwL], lm[IDX.jwR]) / ck,
    chin: dist(lm[IDX.chL], lm[IDX.chR]) / ck,
    length: dist(lm[IDX.top], lm[IDX.chin]) / ck,
    round: polygonArea(oval) / bbox,
    jaw_angle: (angleAt(lm[IDX.ckL], lm[IDX.jwL], lm[IDX.chin]) + angleAt(lm[IDX.ckR], lm[IDX.jwR], lm[IDX.chin])) / 2,
  };

  // y hướng xuống: giá trị dương = "cao hơn"
  const eyeW = (dist(lm[IDX.eyeOutL], lm[IDX.eyeInL]) + dist(lm[IDX.eyeOutR], lm[IDX.eyeInR])) / 2;
  const noseMidY = (lm[IDX.nasion].y + lm[IDX.noseTip].y) / 2;
  const noseLen = dist(lm[IDX.nasion], lm[IDX.noseTip]);
  const malarY = (lm[IDX.malarL].y + lm[IDX.malarR].y) / 2;
  const extra: ExtraRaw = {
    cheekbone_height: (noseMidY - malarY) / noseLen,
    brow_tail_rise: ((lm[IDX.browHeadL].y - lm[IDX.browTailL].y) + (lm[IDX.browHeadR].y - lm[IDX.browTailR].y)) / 2 / eyeW,
    brow_gap: dist(lm[IDX.browHeadL], lm[IDX.browHeadR]) / eyeW,
    eye_tilt: ((lm[IDX.eyeInL].y - lm[IDX.eyeOutL].y) + (lm[IDX.eyeInR].y - lm[IDX.eyeOutR].y)) / 2 / eyeW,
    jaw_ratio: shape.jaw,
    chin_ratio: shape.chin,
  };
  return { ok: true, shape, extra, yaw };
}

// ---------- chuẩn hoá ----------
export type Calib = Record<string, { mean: number; std: number }>;
export function toZ(raw: Record<string, number>, calib: Calib): Record<string, number> {
  const z: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const c = calib[k];
    if (c && c.std > 0 && Number.isFinite(v)) z[k] = (v - c.mean) / c.std;
  }
  return z;
}

// ---------- so khớp prototype ----------
export interface Proto { key: string; prototype: Record<string, number>; required?: string[] }
export interface Scored { key: string; p: number }

/**
 * Khoảng cách bình phương trung bình tới prototype, chỉ trên các chiều có dữ liệu.
 * Thiếu một chiều (vd. cheekbone, santing_balance) thì chiều đó bị bỏ qua, không phạt.
 */
export function softMatch(z: Record<string, number>, protos: Proto[], temperature = 0.5): Scored[] {
  const s = protos.map(pr => {
    if (pr.required?.some(k => !(k in z))) return -Infinity;   // vd. chữ Vương cần độ nổi gò má
    const all = Object.keys(pr.prototype);
    const dims = all.filter(k => k in z);
    if (dims.length < 2 || dims.length < 0.6 * all.length) return -Infinity;
    const d = dims.reduce((acc, k) => acc + (Math.max(-3, Math.min(3, z[k])) - pr.prototype[k]) ** 2, 0) / dims.length;
    return -d;
  });
  const mx = Math.max(...s);
  const e = s.map(v => (v === -Infinity ? 0 : Math.exp((v - mx) / temperature)));
  const sum = e.reduce((a, b) => a + b, 0) || 1;
  return protos.map((pr, i) => ({ key: pr.key, p: e[i] / sum })).sort((a, b) => b.p - a.p);
}

export interface HanhResult {
  primary: string;
  secondary: string | null;   // kiêm hình khi p2 >= KIEM_RATIO * p1
  membership: Scored[];
  label: string;              // vd. "Kim kiêm Thổ"
  confident: boolean;
}
export const KIEM_RATIO = 0.7;
const HANH_NAME: Record<string, string> = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };

export function classifyHanh(z: Record<string, number>, faceTypes: Proto[]): HanhResult {
  const m = softMatch(z, faceTypes);
  const [a, b] = m;
  const secondary = b && b.p >= KIEM_RATIO * a.p ? b.key : null;
  return {
    primary: a.key,
    secondary,
    membership: m,
    label: secondary ? `${HANH_NAME[a.key]} kiêm ${HANH_NAME[secondary]}` : HANH_NAME[a.key],
    confident: a.p >= 0.35,
  };
}

export function classifyLetter(z: Record<string, number>, letters: Proto[]): Scored[] {
  return softMatch(z, letters);
}

// ---------- 12 Chi: khớp theo tiêu chí ----------
export interface ChiCriterion { feature: string; level: 'high' | 'low' }
export interface ChiDef {
  key: string; label: string; criteria: ChiCriterion[];
  category_criteria?: { feature: string; in: string[] }[];
  display: boolean; trait: string | null;
}
const sig = (x: number) => 1 / (1 + Math.exp(-x));

export function matchChi(
  z: Record<string, number>,
  cats: Record<string, string>,
  defs: ChiDef[],
  opt = { minCoverage: 0.5, minScore: 0.65, minMargin: 0.08 },
): { best: { key: string; score: number; coverage: number } | null; all: { key: string; score: number; coverage: number }[] } {
  const all = defs.map(d => {
    const parts: number[] = [];
    let total = d.criteria.length;
    for (const c of d.criteria) {
      if (!(c.feature in z)) continue;
      const v = z[c.feature];
      parts.push(c.level === 'high' ? sig(3 * (v - 0.5)) : sig(3 * (-v - 0.5)));
    }
    for (const cc of d.category_criteria ?? []) {
      total++;
      if (cats[cc.feature] !== undefined) parts.push(cc.in.includes(cats[cc.feature]) ? 1 : 0);
    }
    const coverage = parts.length / total;
    const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    return { key: d.key, score, coverage, display: d.display };
  }).filter(r => r.coverage >= opt.minCoverage).sort((a, b) => b.score - a.score);

  const shown = all.filter(r => r.display);
  const [x, y] = shown;
  const best = x && x.score >= opt.minScore && (!y || x.score - y.score >= opt.minMargin)
    ? { key: x.key, score: x.score, coverage: x.coverage } : null;
  return { best, all: all.map(({ key, score, coverage }) => ({ key, score, coverage })) };
}

// ---------- chân tóc (tuỳ chọn) ----------
/**
 * Ước lượng chân tóc bằng MediaPipe ImageSegmenter, model selfie_multiclass_256x256
 * (category 1 = hair). Quét từ landmark 10 ngược lên theo trục cằm→đỉnh trán tới khi gặp tóc.
 * Trả về null nếu không tìm thấy (tóc mái che, hói, đội mũ) → KHÔNG tính santing_upper.
 */
export function estimateHairlinePx(
  mask: Uint8Array, mw: number, mh: number, lmPx: LM[], imgW: number, imgH: number, hairCat = 1,
): LM | null {
  const top = lmPx[IDX.top], chin = lmPx[IDX.chin];
  const L = dist(top, chin);
  const ux = (top.x - chin.x) / L, uy = (top.y - chin.y) / L;
  let run = 0;
  for (let t = 0; t < 0.6 * L; t += 1) {
    const x = top.x + ux * t, y = top.y + uy * t;
    const mx = Math.round((x / imgW) * mw), my = Math.round((y / imgH) * mh);
    if (mx < 0 || my < 0 || mx >= mw || my >= mh) return null;
    run = mask[my * mw + mx] === hairCat ? run + 1 : 0;
    if (run >= 3) return { x: x - ux * 2, y: y - uy * 2 };   // 3 px liên tiếp là tóc → lùi về mép
  }
  return null;
}

// ---------- trộn với model Kaggle (EfficientNet-B4, 5 lớp) ----------
export const MODEL_CLASSES = ['Heart', 'Oblong', 'Oval', 'Round', 'Square'] as const;   // class_to_idx lúc train
export interface HanhWithModel extends Proto { model_classes?: string[] }

/**
 * Trộn xác suất hình học với xác suất model.
 * - Mỗi lớp model chia đều cho các hành nhận nó trong face_types.json (Heart, Oblong → Mộc; Square → Kim; Round → Thủy).
 * - Phần xác suất của lớp KHÔNG ánh xạ (Oval) được phân lại theo chính phân bố hình học,
 *   nên Hỏa/Thổ (model không có lớp) không bị model đè xuống oan.
 * - Chỉ trộn khi model tự tin >= minConf. alpha nhỏ: model là bằng chứng phụ, hình học vẫn quyết định.
 */
export function fuseWithModel(
  geo: Scored[], modelProbs: number[], types: HanhWithModel[], alpha = 0.3, minConf = 0.5,
): { fused: Scored[]; usedModel: boolean } {
  if (modelProbs.length !== MODEL_CLASSES.length || Math.max(...modelProbs) < minConf) return { fused: geo, usedModel: false };
  const g: Record<string, number> = Object.fromEntries(geo.map(s => [s.key, s.p]));
  const m: Record<string, number> = Object.fromEntries(types.map(t => [t.key, 0]));
  let unmapped = 0;
  MODEL_CLASSES.forEach((c, i) => {
    const owners = types.filter(t => t.model_classes?.includes(c));
    if (!owners.length) { unmapped += modelProbs[i]; return; }
    owners.forEach(t => { m[t.key] += modelProbs[i] / owners.length; });
  });
  for (const k in m) m[k] += unmapped * (g[k] ?? 0);
  const fused = types.map(t => ({ key: t.key, p: (1 - alpha) * (g[t.key] ?? 0) + alpha * m[t.key] }));
  const s = fused.reduce((a, b) => a + b.p, 0) || 1;
  return { fused: fused.map(f => ({ key: f.key, p: f.p / s })).sort((a, b) => b.p - a.p), usedModel: true };
}

/** Giống classifyHanh nhưng nhận membership đã trộn. */
export function labelFromMembership(m: Scored[]): HanhResult {
  const [a, b] = m;
  const secondary = b && b.p >= KIEM_RATIO * a.p ? b.key : null;
  return { primary: a.key, secondary, membership: m, confident: a.p >= 0.35,
    label: secondary ? `${HANH_NAME[a.key]} kiêm ${HANH_NAME[secondary]}` : HANH_NAME[a.key] };
}
