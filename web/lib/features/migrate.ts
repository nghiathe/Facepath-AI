// Nâng cấp bộ đặc trưng cũ đang nằm trong sessionStorage / localStorage.
//
// VÌ SAO CẦN: bản dữ liệu v4 thêm `shape`, `cheekbone.height` và
// `eyebrows.tailRise` vào FaceFeatures. Lượt quét lưu TRƯỚC bản đó không có
// những trường này, mà phiếu kết quả lại đọc thẳng `features.shape.secondary`
// — mở lại một lượt cũ là trang nổ ngay. Lịch sử nằm trên máy người dùng nên
// không "chạy migration" được ở đâu cả: phải vá lúc đọc.
//
// KHÔNG bịa dữ liệu: `faceType` cũ được giữ để phiếu còn dựng lại được, nhưng
// `measured`/`confident` để false vì nó do bản phân loại CŨ chấm — chính bản
// mà v4 thay đi vì cho ra Mộc/Hoả với gần như mọi người. Phiếu sẽ tự nói rằng
// phần ngũ hình chỉ nên đọc như gợi ý.

import type { FaceFeatures, FaceType } from "./types";

const FACE_TYPES: FaceType[] = ["kim", "moc", "thuy", "hoa", "tho"];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Trả về một FaceFeatures dùng được, hoặc null nếu dữ liệu hỏng tới mức không
 * cứu được (thiếu cả những nhánh mà mọi bản đều có).
 */
export function normalizeFeatures(raw: unknown): FaceFeatures | null {
  if (!isObj(raw)) return null;

  const faceType = FACE_TYPES.includes(raw.faceType as FaceType)
    ? (raw.faceType as FaceType)
    : null;
  if (!faceType) return null;
  for (const k of ["santing", "forehead", "eyes", "eyebrows", "nose", "mouth"])
    if (!isObj(raw[k])) return null;

  const f = raw as unknown as FaceFeatures;
  if (isObj(raw.shape) && Array.isArray((raw.shape as { membership?: unknown }).membership))
    return f;

  const cheekbone = raw.cheekbone as Record<string, unknown> | undefined;
  const eyebrows = raw.eyebrows as Record<string, unknown>;
  const quality = (isObj(raw.quality) ? raw.quality : {}) as Record<string, unknown>;

  return {
    ...f,
    shape: {
      raw: {},
      z: {},
      // Toàn bộ khối xác suất dồn vào hành mà bản cũ đã chấm: đó là tất cả
      // những gì lượt quét ấy còn lưu lại được.
      membership: [{ key: faceType, p: 1 }],
      secondary: null,
      label: "",
      confident: false,
      measured: false,
      reason: null,
      calibProvisional: true,
      usedModel: false,
      modelProbs: null,
    },
    cheekbone: {
      prominence: num(cheekbone?.prominence, 0),
      height: num(cheekbone?.height, 0),
    },
    eyebrows: {
      ...f.eyebrows,
      tailRise: num(eyebrows.tailRise, 0),
    },
    quality: {
      ...f.quality,
      yaw: num(quality.yaw, 0),
      eyeSpanPx: num(quality.eyeSpanPx, 0),
    },
  };
}
