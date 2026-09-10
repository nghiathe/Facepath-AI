"use client";

// Lịch sử quét — lưu trong localStorage của chính máy người dùng.
//
// RIÊNG TƯ (CLAUDE.md mục 1): KHÔNG lưu ảnh. Session chuyển ảnh giữa các màn
// bằng sessionStorage (mất khi đóng tab); lịch sử thì sống lâu dài trên máy,
// mà máy có thể là máy dùng chung ở phòng lab — nên chỉ giữ vector số và toạ độ
// điểm mốc, đủ để dựng lại phiếu và lớp bóc tách chứ không dựng lại được gương
// mặt. Không có gì trong đây đi qua mạng.

import { useSyncExternalStore } from "react";
import type { FaceFeatures } from "./features/types";

const KEY = "facepath.history";

/** Giữ 20 lượt gần nhất: đủ cho một buổi trải nghiệm, không phình localStorage. */
export const MAX_ENTRIES = 20;

export type HistoryEntry = {
  /** Bằng mốc thời gian của lượt quét — dùng luôn làm khoá khử trùng lặp. */
  id: string;
  at: number;
  archetype: string;
  ducTinh: string;
  matchedRulesCount: number;
  totalRulesCount: number;
  sourcesCount: number;
  lead: { slug: string; name: string; percent: number } | null;
  /** Nhãn vài nét tính cách nổi nhất, để danh sách đọc được ngay. */
  traits: string[];
  features: FaceFeatures;
  landmarks: { x: number; y: number }[] | null;
};

// --- Đọc/ghi thô ------------------------------------------------------------

function readAll(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as HistoryEntry[]).filter((e) => e?.id && e?.features)
      : [];
  } catch {
    return [];
  }
}

function writeAll(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Hết dung lượng: bỏ toạ độ điểm mốc (phần nặng nhất) rồi thử lại. Phiếu
    // mở lại vẫn đủ chỉ số, chỉ mất lớp bóc tách.
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(entries.map((e) => ({ ...e, landmarks: null })))
      );
    } catch {
      /* đành chịu: lượt quét này không vào được lịch sử */
    }
  }
  emit();
}

/** Làm tròn toạ độ về 4 chữ số: sai lệch không nhìn thấy, kích thước giảm ~40%. */
const trimLandmarks = (pts: { x: number; y: number }[] | null) =>
  pts?.map((p) => ({
    x: Math.round(p.x * 1e4) / 1e4,
    y: Math.round(p.y * 1e4) / 1e4,
  })) ?? null;

// --- API dùng trong UI ------------------------------------------------------

export function listHistory(): HistoryEntry[] {
  return readAll();
}

/**
 * Thêm một lượt quét. Cùng `at` thì ghi đè chứ không nhân bản — mở lại màn
 * phiếu (hoặc StrictMode mount hai lần ở dev) không được đẻ ra bản sao.
 */
export function addHistory(entry: Omit<HistoryEntry, "id">): HistoryEntry {
  const saved: HistoryEntry = {
    ...entry,
    id: String(entry.at),
    landmarks: trimLandmarks(entry.landmarks),
  };
  const rest = readAll().filter((e) => e.id !== saved.id);
  writeAll([saved, ...rest].slice(0, MAX_ENTRIES));
  return saved;
}

export function removeHistory(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* không sao */
  }
  emit();
}

// --- Đọc trong React --------------------------------------------------------
// Cùng lý do như lib/session.ts: localStorage là external store, dùng
// useSyncExternalStore thay vì useEffect + setState. Khác một điểm: lịch sử
// CÓ thay đổi trong lúc trang đang mở (xoá một mục), nên subscribe phải thật.

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Sự kiện `storage` chỉ bắn ở TAB KHÁC, nên nó lo trường hợp người dùng mở
  // hai tab; thay đổi trong chính tab này do emit() ở trên lo.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// getSnapshot phải ổn định tham chiếu, nếu không React render vô hạn — cache
// theo chuỗi JSON thô như session.ts.
let cachedRaw: string | null = null;
let cachedVal: HistoryEntry[] = [];

function getSnapshot(): HistoryEntry[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedVal = readAll();
  }
  return cachedVal;
}

/** undefined = chưa đọc được (lúc render phía máy chủ). */
const getServerSnapshot = (): HistoryEntry[] | undefined => undefined;

export function useHistory(): HistoryEntry[] | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
