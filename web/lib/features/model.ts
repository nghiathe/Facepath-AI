// Chạy model faceshape (EfficientNet-B4) trong trình duyệt — port của
// data/lib/modelInference.ts.
//
// ẢNH KHÔNG RỜI MÁY (CLAUDE.md mục 1): onnxruntime chạy bằng WASM ngay trong
// tab, file .wasm và file .onnx đều tự host ở /onnxruntime/ và /models/. Không
// có lời gọi mạng nào ra ngoài, kể cả tới CDN của onnxruntime — đó là lý do
// scripts/setup-assets.mjs copy wasm từ node_modules thay vì để thư viện tự tải.
//
// DÙNG BẢN fp16 (34 MB). Bản int8 đã đo là HỎNG — nó sập về đúng một lớp
// ("Round") với mọi đầu vào; xem docstring data/tools/export_onnx.py.
//
// MODEL LÀ BẰNG CHỨNG PHỤ. Nó không sinh ra hay sửa trait, trích dẫn hay trọng
// số nghề — chỉ góp xác suất vào việc chọn ngũ hình, với alpha nhỏ, và được ghi
// nguồn riêng (sources.json: model_faceshape_b4, type="model").

import type * as Ort from "onnxruntime-web/wasm";
import type { Landmark } from "./types";

/** Đúng tiền xử lý của notebook: Resize((224,224)) rồi chuẩn hoá ImageNet. */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const SIZE = 224;

const MODEL_URL = "/models/faceshape_b4_fp16.onnx";

/**
 * Tắt model bằng biến môi trường, không cần sửa code:
 *   NEXT_PUBLIC_FACESHAPE_MODEL=off
 *
 * data/README.md yêu cầu thử model trên ~50 ảnh webcam người Việt đã gán nhãn
 * tay trước khi tin nó; đúng dưới ~60% thì tắt hẳn ở đây.
 */
export const MODEL_ENABLED =
  process.env.NEXT_PUBLIC_FACESHAPE_MODEL !== "off";

/**
 * NẠP ĐỘNG, KHÔNG import tĩnh. onnxruntime-web chạy code lúc module được nạp và
 * code đó giả định có môi trường trình duyệt; import tĩnh làm `next build` gãy
 * ngay ở bước prerender màn /analyze ("TypeError: Invalid URL" khi nó tự giải
 * đường dẫn tới file .mjs của mình trong Node). Nạp động thì ort chỉ vào cuộc
 * khi người dùng thật sự bấm chụp, và cũng không nằm trong bundle ban đầu —
 * tiết kiệm cho những người chỉ xem trang chủ.
 */
let ortPromise: Promise<typeof Ort> | null = null;

function getOrt(): Promise<typeof Ort> {
  ortPromise ??= import("onnxruntime-web/wasm").then((ort) => {
    ort.env.wasm.wasmPaths = "/onnxruntime/";
    // Một luồng: đủ nhanh (~0.2–1s một lần chạy) và không cần header COOP/COEP,
    // thứ mà bật lên sẽ làm hỏng việc nhúng các tài nguyên khác.
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = "error";
    return ort;
  });
  return ortPromise;
}

let session: Promise<Ort.InferenceSession> | null = null;

/** Nạp model một lần rồi dùng lại. Lỗi thì cho phép thử lại lần sau. */
export function loadFaceShapeModel(url = MODEL_URL): Promise<Ort.InferenceSession> {
  session ??= getOrt()
    .then((ort) => ort.InferenceSession.create(url, { executionProviders: ["wasm"] }))
    .catch((err) => {
      session = null;
      throw err;
    });
  return session;
}

/**
 * Khung chân dung quanh khuôn mặt: lề 35% hai bên, 60% phía trên (để lấy tóc),
 * 25% phía dưới. Ảnh trong bộ Kaggle là chân dung có tóc và nền, nên cắt sát
 * mặt sẽ lệch hẳn so với lúc train.
 */
export function portraitBox(lmPx: Landmark[], w: number, h: number) {
  const xs = lmPx.map((p) => p.x);
  const ys = lmPx.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const fw = x1 - x0;
  const fh = y1 - y0;
  const left = Math.max(0, x0 - 0.35 * fw);
  const right = Math.min(w, x1 + 0.35 * fw);
  const top = Math.max(0, y0 - 0.6 * fh);
  const bottom = Math.min(h, y1 + 0.25 * fh);
  return { sx: left, sy: top, sw: right - left, sh: bottom - top };
}

/** Biến một vùng ảnh thành tensor NCHW đã chuẩn hoá ImageNet. */
function toTensor(
  ort: typeof Ort,
  source: CanvasImageSource,
  box: { sx: number; sy: number; sw: number; sh: number }
): Ort.Tensor {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Không mở được canvas 2D để tiền xử lý ảnh.");

  // KHÔNG giữ tỉ lệ — đúng như T.Resize((224, 224)) trong notebook. Giữ tỉ lệ ở
  // đây sẽ khác phân phối lúc train.
  ctx.drawImage(source, box.sx, box.sy, box.sw, box.sh, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const x = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++)
    for (let c = 0; c < 3; c++)
      x[c * SIZE * SIZE + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];

  return new ort.Tensor("float32", x, [1, 3, SIZE, SIZE]);
}

export const softmax = (logits: number[]): number[] => {
  const m = Math.max(...logits);
  const e = logits.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0) || 1;
  return e.map((v) => v / s);
};

/**
 * Xác suất 5 lớp theo thứ tự Heart, Oblong, Oval, Round, Square.
 * Ném lỗi nếu model không nạp được — phía gọi phải bắt và đi tiếp bằng hình học.
 */
export async function predictFaceShape(
  source: CanvasImageSource,
  lmPx: Landmark[],
  w: number,
  h: number
): Promise<number[]> {
  const [ort, s] = await Promise.all([getOrt(), loadFaceShapeModel()]);
  const out = await s.run({
    input: toTensor(ort, source, portraitBox(lmPx, w, h)),
  });
  return softmax(Array.from(out.logits.data as Float32Array));
}

/** Dựng <img> từ data URL của ảnh đã chụp (session lưu ảnh dạng đó). */
export function imageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không đọc lại được ảnh đã chụp."));
    img.src = dataUrl;
  });
}
