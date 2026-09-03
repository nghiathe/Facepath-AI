// Gom nét tính cách — PIPELINE.md mục 6.
//
// Mỗi trait giữ danh sách luật đã kích hoạt nó, kèm source + citation, để phiếu
// kết quả có nút "Xem nguồn" tra ngược về đúng chương trong sách.

import type { MatchedRule, Rule } from "./rule-engine";

export type TraitRuleRef = {
  id: string;
  hint: string;
  source: string;
  citation: string;
};

export type Trait = {
  slug: string;
  label: string; // giá trị `trait` tiếng Việt trong rules.json
  score: number; // 0..1
  /**
   * Trọng số mạnh nhất trong các luật đã khớp của trait này.
   *
   * LƯU Ý: dữ liệu hiện tại có đúng 1 luật cho mỗi trait (26 luật / 26 trait),
   * nên công thức score ở mục 6 luôn cho ra 1.0 và không xếp hạng được gì.
   * Vì vậy thứ tự hiển thị dùng weight làm khoá phụ. Khi nào một trait được
   * nhiều luật cùng chống lưng thì score mới có ý nghĩa phân biệt.
   */
  weight: number;
  rules: TraitRuleRef[];
};

/** Bỏ dấu tiếng Việt rồi chuyển thành slug. */
export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu tổ hợp sau khi tách NFD
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * score = tổng weight các luật ĐÃ KHỚP của trait
 *       / tổng weight TẤT CẢ luật cùng trait trong rules.json
 * tức "tín hiệu của nét này đã kích hoạt được bao nhiêu phần". Bound 0..1.
 */
export function aggregateTraits(
  matched: MatchedRule[],
  allRules: Rule[]
): Trait[] {
  const totalByTrait = new Map<string, number>();
  for (const r of allRules) {
    totalByTrait.set(r.trait, (totalByTrait.get(r.trait) ?? 0) + r.weight);
  }

  const grouped = new Map<string, MatchedRule[]>();
  for (const r of matched) {
    const list = grouped.get(r.trait);
    if (list) list.push(r);
    else grouped.set(r.trait, [r]);
  }

  const traits: Trait[] = [];
  for (const [label, rules] of grouped) {
    const hit = rules.reduce((s, r) => s + r.weight, 0);
    const total = totalByTrait.get(label) ?? hit;
    traits.push({
      slug: slugify(label),
      label,
      score: total === 0 ? 0 : hit / total,
      weight: Math.max(...rules.map((r) => r.weight)),
      rules: rules.map((r) => ({
        id: r.id,
        hint: r.reading_hint,
        source: r.source,
        citation: r.citation,
      })),
    });
  }

  // Sắp giảm dần theo score, hoà thì theo weight, hoà nữa thì theo tên cho ổn định.
  return traits.sort(
    (a, b) =>
      b.score - a.score || b.weight - a.weight || a.label.localeCompare(b.label)
  );
}

/** Lấy top N trait cho phiếu (mockup hiển thị khoảng 4-6 thẻ). */
export const topTraits = (traits: Trait[], n = 6) => traits.slice(0, n);
