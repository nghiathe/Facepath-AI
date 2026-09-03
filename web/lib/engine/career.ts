// Chấm điểm nhóm nghề — PIPELINE.md mục 7. Deterministic, không dùng LLM.
//
// Ý nghĩa của percent phải nói đúng: "bao nhiêu phần các đặc điểm mà ngữ liệu
// gắn với nhóm nghề này đã xuất hiện trên khuôn mặt" — tức MỨC KHỚP ĐẶC ĐIỂM,
// không phải dự báo thành công nghề nghiệp (CLAUDE.md mục 1).
//
// Thêm một điểm trung thực nữa, theo data/README.md: phần trọng số nghề là lớp
// diễn giải do nhóm dự án thêm vào, KHÔNG phải kết luận của cổ thư. Chỉ có
// trait + reading_hint + source + citation mới lấy trực tiếp từ sách.

import type { MatchedRule, Rule } from "./rule-engine";

export type Career = {
  slug: string;
  name: string;
  sample_jobs: string;
  sort_order?: number;
};

export type CareerScore = {
  slug: string;
  name: string;
  percent: number; // 0..100
  sample_jobs: string;
  /** Số luật đã khớp có trỏ tới nhóm nghề này. Dùng để cân nhắc độ tin cậy. */
  matchedRules: number;
};

export function scoreCareers(
  matched: MatchedRule[],
  allRules: Rule[],
  careers: Career[]
): CareerScore[] {
  const raw: Record<string, number> = {};
  const maxAttain: Record<string, number> = {};
  const hits: Record<string, number> = {};
  for (const c of careers) {
    raw[c.slug] = 0;
    maxAttain[c.slug] = 0;
    hits[c.slug] = 0;
  }

  // Mẫu số: tổng tín hiệu CÓ THỂ có cho từng nghề.
  for (const r of allRules) {
    for (const [slug, w] of Object.entries(r.careers)) {
      if (slug in maxAttain) maxAttain[slug] += r.weight * w;
    }
  }

  // Tử số: tín hiệu ĐÃ khớp.
  for (const r of matched) {
    for (const [slug, w] of Object.entries(r.careers)) {
      if (slug in raw) {
        raw[slug] += r.weight * w;
        hits[slug] += 1;
      }
    }
  }

  return careers
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      sample_jobs: c.sample_jobs,
      percent: maxAttain[c.slug]
        ? Math.round((100 * raw[c.slug]) / maxAttain[c.slug])
        : 0,
      matchedRules: hits[c.slug],
    }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
}

// TODO (PIPELINE mục 7): nhóm nghề có ít luật trỏ tới thì dễ bị nhiễu — một
// luật khớp có thể đẩy percent lên rất cao. Cân nhắc đặt ngưỡng tối thiểu
// (vd cần >= 2 luật khớp mới hiện %) hoặc pha thêm hệ số theo số tín hiệu.
// Chưa cần cho MVP; dùng trường matchedRules ở trên để quyết định.
