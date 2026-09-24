/**
 * Chạy model faceshape trên trình duyệt bằng onnxruntime-web — ảnh KHÔNG rời máy.
 *   npm i onnxruntime-web
 *   Đặt faceshape_b4_fp16.onnx (tạo bằng tools/export_onnx.py) vào /public/models/.
 *
 * DÙNG BẢN fp16 (34 MB), KHÔNG dùng int8: lượng tử hoá động phá hỏng model —
 * nó sập về đúng một lớp ("Round") với mọi đầu vào. Xem docstring của
 * tools/export_onnx.py để biết số đo và cách làm int8 cho đúng (lượng tử hoá
 * tĩnh, cần tập calibration ảnh thật). fp16 đo được Δprob < 0.002 so với fp32.
 *
 * Tiền xử lý phải giống notebook: ảnh chân dung → Resize((224,224)) KHÔNG giữ tỉ lệ → chuẩn hoá ImageNet.
 * Ảnh trong bộ Kaggle là chân dung có tóc và nền, nên cắt khung rộng quanh mặt (có tóc) rồi mới resize.
 */
import * as ort from 'onnxruntime-web';
import type { LM } from './shapeClassifier';

const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225], SIZE = 224;
let session: ort.InferenceSession | null = null;

export async function loadFaceShapeModel(url = '/models/faceshape_b4_fp16.onnx') {
  session ??= await ort.InferenceSession.create(url, { executionProviders: ['wasm'] });
  return session;
}

/** Khung chân dung: lề 35% hai bên, 60% phía trên (tóc), 25% phía dưới. Chỉnh nếu thấy lệch so với ảnh Kaggle. */
export function portraitBox(lmPx: LM[], w: number, h: number) {
  const xs = lmPx.map(p => p.x), ys = lmPx.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const fw = x1 - x0, fh = y1 - y0;
  const left = Math.max(0, x0 - 0.35 * fw), right = Math.min(w, x1 + 0.35 * fw);
  const top = Math.max(0, y0 - 0.6 * fh), bottom = Math.min(h, y1 + 0.25 * fh);
  return { sx: left, sy: top, sw: right - left, sh: bottom - top };
}

/** Trả về xác suất theo thứ tự Heart, Oblong, Oval, Round, Square. */
export async function predictFaceShape(source: CanvasImageSource, lmPx: LM[], w: number, h: number): Promise<number[]> {
  const s = await loadFaceShapeModel();
  const { sx, sy, sw, sh } = portraitBox(lmPx, w, h);
  const cv = new OffscreenCanvas(SIZE, SIZE);
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, SIZE, SIZE);           // resize không giữ tỉ lệ — như T.Resize((224,224))
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const x = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++)
    for (let c = 0; c < 3; c++) x[c * SIZE * SIZE + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
  const out = await s.run({ input: new ort.Tensor('float32', x, [1, 3, SIZE, SIZE]) });
  const logits = Array.from(out.logits.data as Float32Array);
  const mx = Math.max(...logits), e = logits.map(v => Math.exp(v - mx)), sum = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / sum);
}
