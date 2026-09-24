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
  /** Hành kiêm, nếu hành thứ hai bám sát hành dẫn đầu (features/shape.ts). */
  secondaryFaceType: FaceTypeInfo | null;
  /**
   * false khi không hành nào trội rõ, hoặc khi phép đo dáng mặt bị từ chối.
   * Phiếu PHẢI nói ra điều này thay vì trình bày archetype như một kết luận
   * chắc chắn (CLAUDE.md mục 1: kết quả phải kiểm chứng được).
   */
  faceTypeConfident: boolean;
  /**
   * true khi việc chọn ngũ hình có trộn thêm xác suất của model faceshape.
   * Phiếu PHẢI nói ra và ghi nguồn riêng: model máy học không phải cổ thư
   * (data/README.md — "Ghi chú quan trọng về tính trung thực của dữ liệu").
   */
  usedModel: boolean;
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
  secondary: FaceTypeInfo | null,
  traits: Trait[],
  careers: CareerScore[]
): string {
  const hints = traits
    .slice(0, 3)
    .map((t) => t.rules[0]?.hint)
    .filter((h): h is string => Boolean(h));

  const lead = careers[0];
  const parts = [ft.reading.trim()];

  // Kiêm hình là cách nói của chính cổ thư khi hai hành cùng hiện rõ; nói ra
  // thì trung thực hơn là ép về một hành duy nhất.
  if (secondary) {
    parts.push(
      "Khuôn mặt còn mang nét của " +
        secondary.label.toLowerCase() +
        " — cổ thư gọi là kiêm hình, tức hai hành cùng hiện chứ không thuần một."
    );
  }

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
  const secondary =
    FACE_TYPES.find((f) => f.key === features.shape.secondary) ?? null;

  // Đếm nguồn riêng biệt trong các luật đã khớp (mục 10: "N nguồn dẫn").
  const sourcesCount = new Set(
    matched.map((m) => m.source + "|" + m.citation)
  ).size;

  return {
    faceType: ft,
    archetype: ft.label,
    secondaryFaceType: secondary,
    faceTypeConfident: features.shape.measured && features.shape.confident,
    usedModel: features.shape.usedModel,
    matchedRulesCount: matched.length,
    totalRulesCount: RULES.length,
    sourcesCount,
    traits,
    careers,
    reading: buildReading(ft, secondary, traits, careers),
    features,
    matched,
    elapsedMs: performance.now() - started,
  };
}
