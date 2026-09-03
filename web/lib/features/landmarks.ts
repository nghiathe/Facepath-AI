// Bọc MediaPipe Face Landmarker — CLAUDE.md mục 4.
//
// TOÀN BỘ chạy trong trình duyệt bằng WASM. Ảnh và khung hình không rời thiết
// bị: model được tự host ở /mediapipe/, không gọi CDN lúc chạy, và không có
// đường nào đẩy pixel lên server.

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { Landmark } from "./types";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Khởi tạo một lần rồi dùng lại (nạp model ~3.6MB nên đừng tạo lặp). */
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    })().catch((err) => {
      landmarkerPromise = null; // cho phép thử lại nếu lần nạp này hỏng
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Lấy mảng điểm mốc của khuôn mặt đầu tiên, hoặc null nếu không thấy mặt. */
function firstFace(result: FaceLandmarkerResult | undefined): Landmark[] | null {
  const face = result?.faceLandmarks?.[0];
  return face && face.length > 0 ? (face as Landmark[]) : null;
}

export async function detectFromVideo(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<Landmark[] | null> {
  const lm = await getLandmarker();
  return firstFace(lm.detectForVideo(video, timestampMs));
}

export async function detectFromImage(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<Landmark[] | null> {
  const lm = await getLandmarker();
  // Ảnh tĩnh vẫn dùng detectForVideo với mốc thời gian tăng dần, để khỏi phải
  // tạo thêm một landmarker ở runningMode IMAGE (mỗi cái tốn ~3.6MB bộ nhớ).
  return firstFace(lm.detectForVideo(source, performance.now()));
}

/**
 * Độ sáng trung bình 0..1 của khung hình, dùng cho quality.brightness.
 * Lấy mẫu thưa cho nhẹ; chỉ đọc pixel trong bộ nhớ, không gửi đi đâu.
 */
export function measureBrightness(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  canvas: HTMLCanvasElement
): number {
  const w = 64;
  const h = 64;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 1;
  try {
    ctx.drawImage(source, 0, 0, w, h);
  } catch {
    return 1;
  }
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Hệ số độ sáng cảm nhận (Rec. 601).
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (data.length / 4) / 255;
}

/** Đọc file ảnh người dùng chọn thành <img>. File KHÔNG được tải lên đâu cả. */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh này."));
    };
    img.src = url;
  });
}
