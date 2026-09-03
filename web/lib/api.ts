// Gọi backend FastAPI — chỉ dùng cho tra cứu (Kho luận giải, Về phương pháp).
//
// Việc chấm điểm KHÔNG đi qua đây: rule engine chạy ngay trong trình duyệt
// (web/lib/engine/), nên một lượt quét không phát sinh request nào. Trước đây
// có hàm analyze() POST lên /api/analyze; đã bỏ vì endpoint đó không tồn tại
// và cũng không cần nữa.
//
// BẤT BIẾN (CLAUDE.md mục 1 + 13): không bao giờ gửi ảnh hay khung hình.
// Nếu cần thêm hàm gửi ảnh lên server — dừng lại và hỏi trước.

import type { CareerGroup, FeatureCatalog, HealthStatus, Rule } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} thất bại: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const getHealth = () => getJson<HealthStatus>("/api/health");

export const getCareers = () => getJson<CareerGroup[]>("/api/careers");

export const getFeatures = () => getJson<FeatureCatalog>("/api/features");

export const getRules = (featureKey?: string) =>
  getJson<Rule[]>(`/api/rules${featureKey ? `?feature=${encodeURIComponent(featureKey)}` : ""}`);
