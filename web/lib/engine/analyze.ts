// Gộp cả chuỗi thành một lời gọi — CLAUDE.md mục 9 + 10.
//
// Deterministic, không dùng LLM. Đoạn luận giải hiện được ghép bằng template từ
// reading_hint của các luật khớp mạnh nhất; mốc 5 sẽ thay bằng RAG + LLM nhưng
// giữ nguyên hình dạng dữ liệu này.

import { CAREERS, FACE_TYPES, RULES, type FaceTypeInfo } from "../data";
import type { FaceFeatures } from "../features/types";
import { scoreCareers, type CareerScore } from "./career";
import { evaluateRules, type MatchedRule } from "./rule-engine";
import { aggregateTraits, topTraits, type Trait } from "./traits";

export type AnalysisResult = {
  faceType: FaceTypeInfo;
  /** Nhãn hiển thị trên phiếu, vd "Mặt chữ Nhật — kim hình". */
  archetype: string;
  matchedRulesCount: number;
  totalRulesCount: number;
  sourcesCount: number;
  traits: Trait[];
  careers: CareerScore[];
  reading: string;
  features: FaceFeatures;
  matched: MatchedRule[];
  /** Thời gian chạy thật, ms — để màn Phân tích khỏi phải bịa con số. */
  elapsedMs: number;
};

/**
 * Ghép đoạn luận giải từ các luật khớp mạnh nhất (CLAUDE.md mục 9).
 * Chỉ nối lại lời của sách, không thêm nhận định mới.
 */
function buildReading(
  ft: FaceTypeInfo,
  traits: Trait[],
  careers: CareerScore[]
): string {
  const hints = traits
    .slice(0, 3)
    .map((t) => t.rules[0]?.hint)
    .filter((h): h is string => Boolean(h));

  const lead = careers[0];
  const parts = [ft.reading.trim()];

  if (hints.length) {
    parts.push(
      "Trên khuôn mặt còn đọc được: " +
        hints.map((h) => h.charAt(0).toLowerCase() + h.slice(1)).join("; ") +
        "."
    );
  }
  if (lead) {
    parts.push(
      "Các đặc điểm này trùng nhiều nhất với mô tả mà ngữ liệu gắn cho nhóm " +
        lead.name.toLowerCase() +
        " (" +
        lead.sample_jobs.toLowerCase() +
        "). Đây là mức khớp đặc điểm, không phải dự báo thành công nghề nghiệp."
    );
  }
  return parts.join(" ");
}

export function analyzeFeatures(features: FaceFeatures): AnalysisResult {
  const started = performance.now();

  const matched = evaluateRules(features, RULES);
  const traits = topTraits(aggregateTraits(matched, RULES), 6);
  const careers = scoreCareers(matched, RULES, CAREERS);

  const ft =
    FACE_TYPES.find((f) => f.key === features.faceType) ?? FACE_TYPES[0];

  // Đếm nguồn riêng biệt trong các luật đã khớp (mục 10: "N nguồn dẫn").
  const sourcesCount = new Set(
    matched.map((m) => m.source + "|" + m.citation)
  ).size;

  return {
    faceType: ft,
    archetype: ft.label,
    matchedRulesCount: matched.length,
    totalRulesCount: RULES.length,
    sourcesCount,
    traits,
    careers,
    reading: buildReading(ft, traits, careers),
    features,
    matched,
    elapsedMs: performance.now() - started,
  };
}
