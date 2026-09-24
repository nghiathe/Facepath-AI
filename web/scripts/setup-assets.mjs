// Chuẩn bị tài nguyên chạy-trên-máy cho việc tự host: MediaPipe + onnxruntime-web.
//
// Chạy tự động trước `npm run dev` và `npm run build` (hook predev/prebuild).
// Bỏ qua nếu file đã có, nên chạy lại rất nhanh.
//
// Vì sao tự host thay vì gọi CDN: nguyên tắc mục 1 của CLAUDE.md là ảnh không
// rời thiết bị. Nạp model từ CDN thì ảnh vẫn ở máy, nhưng ta lại lệ thuộc một
// bên thứ ba lúc chạy và rò rỉ thông tin "ai đang dùng app" cho họ. Tự host thì
// không. Đây cũng là lý do font Be Vietnam Pro dùng next/font (tự host).
//
// Thư mục public/mediapipe/ và public/onnxruntime/ bị .gitignore chặn (wasm
// nặng) — script này dựng lại.
//
// RIÊNG public/models/faceshape_b4_fp16.onnx thì script KHÔNG dựng được: nó
// sinh ra từ best_model.pth bằng data/tools/export_onnx.py (cần torch). Thiếu
// file đó thì app vẫn chạy bình thường, chỉ là không có bằng chứng từ model —
// xem lib/features/model.ts.

import { createWriteStream } from "node:fs";
import { access, cp, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");

const WASM_SRC = join(WEB, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const WASM_DEST = join(WEB, "public", "mediapipe", "wasm");

// onnxruntime-web: chỉ cần cặp file của bản wasm tối thiểu (~14MB). Các bản
// jsep/webgpu/asyncify/jspi nặng hơn nhiều và không dùng tới, vì lib/features/
// model.ts import từ "onnxruntime-web/wasm" và chạy executionProviders:["wasm"].
const ORT_SRC = join(WEB, "node_modules", "onnxruntime-web", "dist");
const ORT_DEST = join(WEB, "public", "onnxruntime");
const ORT_FILES = ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"];

const MODEL_DEST = join(WEB, "public", "mediapipe", "models", "face_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const exists = (p) => access(p).then(() => true, () => false);

async function copyWasm() {
  if (!(await exists(WASM_SRC))) {
    throw new Error(
      "Không thấy " + WASM_SRC + ".\nChạy `npm install` trước."
    );
  }
  if (await exists(join(WASM_DEST, "vision_wasm_internal.wasm"))) {
    console.log("  wasm: đã có, bỏ qua.");
    return;
  }
  await mkdir(WASM_DEST, { recursive: true });
  await cp(WASM_SRC, WASM_DEST, { recursive: true });
  console.log("  wasm: đã copy từ node_modules.");
}

async function fetchModel() {
  if (await exists(MODEL_DEST)) {
    const { size } = await stat(MODEL_DEST);
    console.log("  model: đã có (" + (size / 1024 / 1024).toFixed(1) + " MB), bỏ qua.");
    return;
  }
  await mkdir(dirname(MODEL_DEST), { recursive: true });
  console.log("  model: đang tải face_landmarker.task ...");
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    throw new Error(
      "Tải model thất bại: " + res.status + " " + res.statusText +
      "\nTải tay từ " + MODEL_URL + "\nrồi đặt vào " + MODEL_DEST
    );
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(MODEL_DEST));
  const { size } = await stat(MODEL_DEST);
  console.log("  model: xong (" + (size / 1024 / 1024).toFixed(1) + " MB).");
}

async function copyOrt() {
  if (!(await exists(ORT_SRC))) {
    throw new Error("Không thấy " + ORT_SRC + ".\nChạy `npm install` trước.");
  }
  if (await exists(join(ORT_DEST, ORT_FILES[0]))) {
    console.log("  onnxruntime: đã có, bỏ qua.");
    return;
  }
  await mkdir(ORT_DEST, { recursive: true });
  let total = 0;
  for (const f of ORT_FILES) {
    await cp(join(ORT_SRC, f), join(ORT_DEST, f));
    total += (await stat(join(ORT_DEST, f))).size;
  }
  console.log("  onnxruntime: đã copy (" + (total / 1024 / 1024).toFixed(1) + " MB).");
}

async function reportFaceShapeModel() {
  const p = join(WEB, "public", "models", "faceshape_b4_fp16.onnx");
  if (await exists(p)) {
    const { size } = await stat(p);
    console.log("  faceshape: có (" + (size / 1024 / 1024).toFixed(1) + " MB).");
  } else {
    console.log(
      "  faceshape: CHƯA CÓ — app vẫn chạy, chỉ thiếu bằng chứng từ model.\n" +
      "             Dựng bằng: python data/tools/export_onnx.py data/best_model.pth \\\n" +
      "                          --out web/public/models/faceshape_b4"
    );
  }
}

console.log("Chuẩn bị tài nguyên tự host:");
await copyWasm();
await fetchModel();
await copyOrt();
await reportFaceShapeModel();
