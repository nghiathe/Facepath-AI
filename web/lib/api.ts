// Gọi backend FastAPI.
//
// BẤT BIẾN (CLAUDE.md mục 1 + 13): chỉ gửi CON SỐ, không bao giờ gửi ảnh hay
// khung hình. Nếu cần thêm hàm gửi ảnh lên server — dừng lại và hỏi trước.

import type {
  AnalyzeResult,
  CareerGroup,
  FeatureCatalog,
  FeatureVector,
  HealthStatus,
  Rule,
} from "./types";

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

/** MỐC 3. Chỉ gửi vector số — không kèm ảnh. */
export const analyze = (features: FeatureVector) =>
  getJson<AnalyzeResult>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ features }),
  });
