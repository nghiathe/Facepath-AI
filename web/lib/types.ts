// Kiểu dữ liệu khớp JSON của API (CLAUDE.md mục 10).
// Khai báo sẵn cả phần của mốc 3 để lúc đó cắm vào không phải sửa chỗ khác.

/** Vector đặc trưng khuôn mặt: feature_key -> giá trị đã chuẩn hoá. */
export type FeatureVector = Record<string, number>;

export type Trait = {
  label: string;
  hint: string;
  source: string;
  citation: string;
};

export type CareerGroup = {
  slug: string;
  name: string;
  sample_jobs: string;
};

export type ScoredCareerGroup = CareerGroup & {
  /** Mức khớp 0-100. KHÔNG phải dự báo thành công nghề nghiệp. */
  score: number;
};

/** Trả về của POST /api/analyze — MỐC 3, chưa hiện thực ở mốc 1. */
export type AnalyzeResult = {
  archetype: string;
  matched_rules_count: number;
  traits: Trait[];
  career_groups: ScoredCareerGroup[];
  reading: string | null;
  sources_count: number;
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
