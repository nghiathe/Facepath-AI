// Vẽ 4 lớp bóc tách chồng lên ảnh đã chụp — CLAUDE.md mục 4 + 11.
//
// Toạ độ điểm mốc đã chuẩn hoá về [0,1] nên nhân với kích thước canvas là ra.
// Màu trùng với chú giải trong mockup.

import {
  FACE_OVAL,
  LEFT_EYEBROW,
  PT,
  RIGHT_EYEBROW,
} from "./landmark-ids";
import type { Landmark } from "./types";

export const LAYER_COLORS = {
  face: "#4ADE80", // dáng mặt
  santing: "#7FB4FF", // tam đình
  brow: "#F0A81E", // cung mày
  nose: "#FF7A7A", // cánh mũi
  mouth: "#C97BFF", // khoé miệng
} as const;

export type OverlayLayers = {
  face: boolean;
  santing: boolean;
  brow: boolean;
  nose: boolean;
  mouth: boolean;
};

export const ALL_LAYERS: OverlayLayers = {
  face: true,
  santing: true,
  brow: true,
  nose: true,
  mouth: true,
};

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  lm: Landmark[],
  w: number,
  h: number,
  layers: OverlayLayers = ALL_LAYERS
): void {
  ctx.clearRect(0, 0, w, h);
  if (!lm.length) return;

  const X = (i: number) => lm[i].x * w;
  const Y = (i: number) => lm[i].y * h;

  const dot = (i: number, color: string, r = 1.6) => {
    ctx.beginPath();
    ctx.arc(X(i), Y(i), r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  const hLine = (y: number, color: string) => {
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.moveTo(w * 0.08, y);
    ctx.lineTo(w * 0.92, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Lớp 1a — đường viền dáng mặt (chấm theo đường bao oval)
  if (layers.face) {
    for (const i of FACE_OVAL) dot(i, LAYER_COLORS.face, 1.8);
  }

  // Lớp 1b — ba vạch tam đình: chân tóc / giữa mày / chân mũi / cằm
  if (layers.santing) {
    const brows = [...LEFT_EYEBROW, ...RIGHT_EYEBROW];
    const browY = (brows.reduce((s, i) => s + lm[i].y, 0) / brows.length) * h;
    hLine(Y(PT.FOREHEAD_TOP), LAYER_COLORS.santing);
    hLine(browY, LAYER_COLORS.santing);
    hLine(Y(PT.NOSE_BASE), LAYER_COLORS.santing);
    hLine(Y(PT.CHIN_BOTTOM), LAYER_COLORS.santing);
  }

  // Lớp 2 — cung mày
  if (layers.brow) {
    for (const i of [...LEFT_EYEBROW, ...RIGHT_EYEBROW]) dot(i, LAYER_COLORS.brow, 2);
  }

  // Lớp 3 — cánh mũi
  if (layers.nose) {
    ctx.beginPath();
    ctx.moveTo(X(PT.ALA_RIGHT), Y(PT.ALA_RIGHT));
    ctx.lineTo(X(PT.ALA_LEFT), Y(PT.ALA_LEFT));
    ctx.strokeStyle = LAYER_COLORS.nose;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    dot(PT.ALA_RIGHT, LAYER_COLORS.nose, 2.4);
    dot(PT.ALA_LEFT, LAYER_COLORS.nose, 2.4);
    dot(PT.NOSE_TIP, LAYER_COLORS.nose, 2);
  }

  // Lớp 4 — khoé miệng
  if (layers.mouth) {
    ctx.beginPath();
    ctx.moveTo(X(PT.MOUTH_R), Y(PT.MOUTH_R));
    ctx.lineTo(X(PT.MOUTH_L), Y(PT.MOUTH_L));
    ctx.strokeStyle = LAYER_COLORS.mouth;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (const i of [PT.MOUTH_R, PT.MOUTH_L, PT.LIP_UPPER_OUTER, PT.LIP_LOWER_OUTER])
      dot(i, LAYER_COLORS.mouth, 2.2);
  }
}

// --- Lưới điểm mốc vẽ trực tiếp lên khung camera (màn 02) -------------------
//
// Khác với drawOverlay ở trên (vẽ lên ẢNH ĐÃ CHỤP trên phiếu), phần này vẽ
// chồng lên thẻ <video> đang chạy. Hai khác biệt bắt buộc phải xử lý:
//
//  1. Thẻ video dùng object-cover nên khung hình bị CẮT chứ không co giãn cho
//     vừa. Map toạ độ [0,1] thẳng sang kích thước canvas là điểm lệch khỏi mặt
//     ngay khi tỉ lệ camera khác tỉ lệ khung (rất hay gặp: nhiều webcam trả
//     16:9 trong lúc khung vẽ 4:3). coverBox() tính lại đúng phép cắt đó.
//  2. Video bị lật gương (scaleX(-1)) cho tự nhiên khi soi. Canvas phủ lên
//     ĐƯỢC LẬT CÙNG bằng CSS ở màn 02, nên ở đây cứ vẽ theo toạ độ gốc.

export type CoverBox = {
  /** Lề trái/trên của khung hình sau khi cắt (âm khi bị cắt bớt). */
  ox: number;
  oy: number;
  /** Bề rộng/cao của khung hình sau khi phóng để phủ kín. */
  dw: number;
  dh: number;
};

/** Phép map tương đương CSS `object-fit: cover`. */
export function coverBox(vw: number, vh: number, w: number, h: number): CoverBox {
  if (!vw || !vh) return { ox: 0, oy: 0, dw: w, dh: h };
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  return { ox: (w - dw) / 2, oy: (h - dh) / 2, dw, dh };
}

/**
 * Lưới 478 điểm mốc + 4 lớp bóc tách, vẽ live lên khung camera.
 *
 * `ok` = đã đủ điều kiện chụp: khi đủ thì lưới sáng lên và chuyển sang màu của
 * từng lớp, chưa đủ thì để trắng mờ. Đây là phản hồi trực quan cho người đang
 * đứng trước camera — họ thấy được ngay là "đã bắt đúng mặt" mà không cần đọc
 * chữ, thứ mà người xem ở cuối hội trường cũng đọc theo được.
 */
export function drawLiveMesh(
  ctx: CanvasRenderingContext2D,
  lm: Landmark[],
  box: CoverBox,
  ok: boolean
): void {
  const { ox, oy, dw, dh } = box;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!lm.length) return;

  const X = (i: number) => ox + lm[i].x * dw;
  const Y = (i: number) => oy + lm[i].y * dh;

  // Toàn bộ lưới: chấm rất nhỏ, độ mờ thấp — đủ thấy là "có lưới phủ lên mặt"
  // mà không che mất gương mặt bên dưới.
  ctx.fillStyle = ok ? "rgba(160,200,255,0.5)" : "rgba(255,255,255,0.28)";
  for (const p of lm) {
    ctx.fillRect(ox + p.x * dw - 0.6, oy + p.y * dh - 0.6, 1.2, 1.2);
  }

  // Đường bao dáng mặt: nối liền thành một vòng khép kín cho ra hình rõ ràng.
  ctx.beginPath();
  FACE_OVAL.forEach((i, k) => (k ? ctx.lineTo(X(i), Y(i)) : ctx.moveTo(X(i), Y(i))));
  ctx.closePath();
  ctx.strokeStyle = ok ? LAYER_COLORS.face : "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Chưa đủ điều kiện thì dừng ở đây: tô màu 4 lớp lúc số đo còn chưa đáng tin
  // sẽ khiến người xem tưởng hệ thống đã đọc xong.
  if (!ok) return;

  const stroke = (a: number, b: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(X(a), Y(a));
    ctx.lineTo(X(b), Y(b));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  ctx.lineCap = "round";
  for (const brow of [LEFT_EYEBROW, RIGHT_EYEBROW]) {
    ctx.beginPath();
    brow.forEach((i, k) => (k ? ctx.lineTo(X(i), Y(i)) : ctx.moveTo(X(i), Y(i))));
    ctx.strokeStyle = LAYER_COLORS.brow;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  stroke(PT.ALA_RIGHT, PT.ALA_LEFT, LAYER_COLORS.nose);
  stroke(PT.MOUTH_R, PT.MOUTH_L, LAYER_COLORS.mouth);
}
