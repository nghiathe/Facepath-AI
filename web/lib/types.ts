// Kiểu dữ liệu cho các endpoint TRA CỨU của API (CLAUDE.md mục 10).
//
// Kiểu của luồng chấm điểm nằm ở web/lib/engine/ (AnalysisResult, Trait,
// CareerScore) vì engine chạy client-side, không qua API.

export type CareerGroup = {
  slug: string;
  name: string;
  sample_jobs: string;
};

export type Rule = {
  id: number;
  feature_key: string;
  feature_label: string;
  op: "lt" | "lte" | "gt" | "gte" | "between" | "category";
  v_min: number | null;
  v_max: number | null;
  category: string | null;
  reading_hint: string;
  weight: number;
  trait: string;
  trait_description: string | null;
  source: string;
  citation: string;
  careers: { slug: string; name: string; weight: number }[];
};

export type FeatureCatalog = {
  count: number;
  keys: string[];
  layers: Record<string, Record<string, string>>;
  live: string[];
};

export type HealthStatus = {
  status: "ok" | "degraded";
  db: "ok" | "error";
  feature_count: number;
  rule_count: number | null;
  detail: string | null;
};
