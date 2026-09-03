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
