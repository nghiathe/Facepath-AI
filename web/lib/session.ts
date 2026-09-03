"use client";

// Chuyển kết quả đo giữa các màn (Quét → Phân tích → Phiếu kết quả).
//
// Dùng sessionStorage: dữ liệu nằm trong tab của người dùng, mất khi đóng tab,
// và KHÔNG bao giờ đi qua mạng. Chỉ chứa vector số (FaceFeatures) cùng ảnh thu
// nhỏ dạng data URL để vẽ lớp bóc tách — cả hai đều ở lại trên máy.

import { useSyncExternalStore } from "react";
import type { FaceFeatures } from "./features/types";

const KEY = "facepath.scan";

export type ScanPayload = {
  features: FaceFeatures;
  /** Ảnh đã chụp dạng data URL, chỉ để hiển thị lại trên phiếu. */
  snapshot: string | null;
  /** Toạ độ điểm mốc đã chuẩn hoá, để vẽ overlay. */
  landmarks: { x: number; y: number }[] | null;
  at: number;
};

export function saveScan(payload: Omit<ScanPayload, "at">): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...payload, at: Date.now() } satisfies ScanPayload)
    );
  } catch {
    // Hết dung lượng (ảnh quá lớn) — vẫn giữ được phần vector số.
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          features: payload.features,
          snapshot: null,
          landmarks: payload.landmarks,
          at: Date.now(),
        } satisfies ScanPayload)
      );
    } catch {
      /* bỏ qua: phiếu sẽ báo chưa có dữ liệu quét */
    }
  }
}

export function loadScan(): ScanPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScanPayload;
    return parsed?.features ? parsed : null;
  } catch {
    return null;
  }
}

export function clearScan(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* không sao */
  }
}

// --- Đọc trong React --------------------------------------------------------
// Dùng useSyncExternalStore thay vì useEffect + setState: sessionStorage là một
// external store, và gọi setState đồng bộ trong effect gây cascading render
// (React 19 cảnh báo thẳng). getSnapshot phải trả về giá trị ỔN ĐỊNH THAM CHIẾU,
// nếu không React sẽ render vô hạn — nên cache theo chuỗi JSON thô.

let cachedRaw: string | null = null;
let cachedVal: ScanPayload | null = null;

function getSnapshot(): ScanPayload | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as ScanPayload) : null;
      cachedVal = parsed?.features ? parsed : null;
    } catch {
      cachedVal = null;
    }
  }
  return cachedVal;
}

/** Lúc render phía máy chủ chưa đọc được sessionStorage -> trạng thái "đang mở". */
const getServerSnapshot = (): ScanPayload | null | undefined => undefined;

/** Không có nguồn thay đổi từ bên ngoài trong vòng đời một trang. */
const subscribe = () => () => {};

/** undefined = chưa biết (SSR), null = phiên này chưa quét, còn lại là dữ liệu. */
export function useScan(): ScanPayload | null | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
