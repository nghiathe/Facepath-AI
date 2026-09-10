// Gọi backend FastAPI — client cho các endpoint tra cứu (mục 10).
//
// HIỆN CHƯA MÀN NÀO DÙNG, và đó là chủ ý: cả engine lẫn trang "Khám phá" đều
// đọc data/rules.json đã nằm sẵn trong bundle (lib/data.ts), nên một lượt quét
// không phát sinh request nào và tra cứu vẫn chạy khi backend chưa bật. Giữ
// module này cho các mốc sau — RAG + LLM (POST /api/reading) phải qua máy chủ,
// và lúc đó bộ luật sẽ được đọc từ MySQL thay vì file tĩnh.
//
// Trước đây có hàm analyze() POST lên /api/analyze; đã bỏ vì endpoint đó không
// tồn tại và việc chấm điểm cũng không cần rời máy người dùng.
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
