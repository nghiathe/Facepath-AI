"use client";

import { useMemo, useState } from "react";
import { CAREERS, FACE_TYPES, formatSource, RULES, SOURCES } from "@/lib/data";
import { describeCondition } from "@/lib/engine/describe";
import type { Rule } from "@/lib/engine/rule-engine";
import { FEATURE_LAYERS, featureLabel, featureLayer } from "@/lib/features/catalog";

// Trang "Khám phá" — tra cứu bộ luật và nguồn dẫn (CLAUDE.md mục 10:
// GET /api/rules?feature=...).
//
// Đọc thẳng data/rules.json đã nằm trong bundle (lib/data.ts) thay vì gọi API:
// đây đúng là bộ luật mà engine chạy trên máy người dùng, nên trang tra cứu và
// phiếu kết quả không bao giờ lệch nhau, và tab này vẫn dùng được khi backend
// chưa bật. Endpoint /api/rules giữ nguyên cho việc tra cứu phía máy chủ.

type Tab = "rules" | "faces" | "careers" | "sources";

const TABS: { key: Tab; label: string; count: number }[] = [
  { key: "rules", label: "Bộ luật", count: RULES.length },
  { key: "faces", label: "Ngũ hình", count: FACE_TYPES.length },
  { key: "careers", label: "Nhóm nghề", count: CAREERS.length },
  { key: "sources", label: "Nguồn dẫn", count: SOURCES.length },
];

/** Bỏ dấu để ô tìm kiếm gõ "cung may" vẫn ra "cung mày". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();

const careerName = (slug: string) =>
  CAREERS.find((c) => c.slug === slug)?.name ?? slug;

function RuleCard({ r }: { r: Rule }) {
  const careers = Object.entries(r.careers).sort((a, b) => b[1] - a[1]);
  return (
    <li className="flex flex-col gap-2.5 rounded-card border border-line-soft bg-card px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <code className="rounded-[6px] bg-surface px-1.5 py-0.5 text-[11.5px] text-blue-deep">
          {r.feature_key}
        </code>
        <span className="text-[13px] text-ink-faint">{featureLabel(r.feature_key)}</span>
        <span className="text-[13px] font-semibold text-ink-title">
          {describeCondition(r)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <strong className="text-[15px] font-semibold text-ink-title">{r.trait}</strong>
        <span className="text-[13.5px] font-light leading-relaxed text-ink-muted">
          {r.reading_hint}
        </span>
      </div>

      {/* Phần kiểm chứng được: trait + hint + nguồn lấy trực tiếp từ sách. */}
      <span className="text-[12.5px] italic text-ink-faint">
        {formatSource(r.source, r.citation)}
      </span>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2.5">
        <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-ink-faintest">
          Cộng điểm cho
        </span>
        {careers.map(([slug, w]) => (
          <span
            key={slug}
            className="rounded-[8px] bg-surface px-2 py-1 text-[11.5px] text-ink-body"
          >
            {careerName(slug)} <strong className="font-semibold">{w.toFixed(2)}</strong>
          </span>
        ))}
      </div>
    </li>
  );
}

function RulesTab() {
  const [feature, setFeature] = useState("");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = fold(q.trim());
    return RULES.filter((r) => {
      if (feature && r.feature_key !== feature) return false;
      if (!needle) return true;
      const haystack = [
        r.trait,
        r.reading_hint,
        r.feature_key,
        featureLabel(r.feature_key),
        r.id,
      ].join(" ");
      return fold(haystack).includes(needle);
    });
  }, [feature, q]);

  // Nhóm theo lớp bóc tách để danh sách đọc theo đúng thứ tự trên phiếu.
  const groups = FEATURE_LAYERS.map((l) => ({
    layer: l.layer,
    rules: shown.filter((r) => featureLayer(r.feature_key) === l.layer),
  })).filter((g) => g.rules.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo nét tính cách, mô tả hoặc tên chỉ số…"
          aria-label="Tìm trong bộ luật"
          className="flex-1 rounded-btn border border-line-strong bg-card px-4 py-3 text-sm text-ink-body outline-none placeholder:text-ink-faintest focus:border-blue"
        />
        <select
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          aria-label="Lọc theo chỉ số"
          className="rounded-btn border border-line-strong bg-card px-4 py-3 text-sm text-ink-body outline-none focus:border-blue sm:w-72"
        >
          <option value="">Tất cả chỉ số ({RULES.length} luật)</option>
          {FEATURE_LAYERS.map((l) => (
            <optgroup key={l.layer} label={l.layer}>
              {Object.entries(l.keys).map(([key, label]) => {
                const n = RULES.filter((r) => r.feature_key === key).length;
                return (
                  <option key={key} value={key} disabled={n === 0}>
                    {label} ({n})
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </div>

      <p className="text-[13px] text-ink-faintest">
        {shown.length} / {RULES.length} luật
        {feature ? ` · lọc theo ${featureLabel(feature)}` : ""}
      </p>

      {groups.length === 0 && (
        <p className="rounded-card border border-line-soft bg-card px-5 py-6 text-sm text-ink-muted">
          Không có luật nào khớp từ khoá này.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.layer} className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-blue">
            {g.layer}
          </h2>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {g.rules.map((r) => (
              <RuleCard key={r.id} r={r} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FacesTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[720px] text-sm font-light leading-relaxed text-ink-faint">
        Ngũ hình là cách cổ thư xếp khuôn mặt vào năm dạng, mỗi dạng gắn với một
        đức trong ngũ thường. Kiểu tướng hiện trên phiếu chính là một trong năm
        mục dưới đây, chọn theo dáng mặt đo được.
      </p>
      {FACE_TYPES.map((f) => (
        <article
          key={f.key}
          className="flex flex-col gap-2 rounded-card border border-line-soft bg-card px-5 py-4"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-[17px] font-semibold text-ink-title">{f.label}</h2>
            <span className="rounded-[8px] bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-blue-deep">
              đức {f.duc_tinh}
            </span>
            <code className="text-[11.5px] text-ink-faintest">face_shape = {f.key}</code>
          </div>
          <p className="text-[14px] font-light leading-relaxed text-ink-body">{f.summary}</p>
          <p className="text-[13.5px] font-light leading-relaxed text-ink-muted">
            {f.reading}
          </p>
          <span className="text-[12.5px] text-ink-faintest">
            Dấu hiệu nhận dạng: {f.trigger}
          </span>
          <span className="text-[12.5px] italic text-ink-faint">
            {formatSource(f.source, f.citation)}
          </span>
        </article>
      ))}
    </div>
  );
}

function CareersTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[720px] text-sm font-light leading-relaxed text-ink-faint">
        Sáu nhóm nghề mà bộ luật chấm điểm. Số luật bên dưới cho biết mỗi nhóm
        được bao nhiêu luật trỏ tới — nhóm có ít luật thì điểm dễ nhiễu hơn.
      </p>
      {[...CAREERS]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((c) => {
          const linked = RULES.filter((r) => c.slug in r.careers);
          const traits = [...new Set(linked.map((r) => r.trait))].slice(0, 6);
          return (
            <article
              key={c.slug}
              className="flex flex-col gap-2 rounded-card border border-line-soft bg-card px-5 py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[17px] font-semibold text-ink-title">{c.name}</h2>
                <span className="text-[12.5px] text-ink-faintest">
                  {linked.length} luật trỏ tới
                </span>
              </div>
              <span className="text-[13.5px] font-light text-ink-muted">
                {c.sample_jobs}
              </span>
              <div className="flex flex-wrap gap-1.5 border-t border-line-soft pt-2.5">
                {traits.map((t) => (
                  <span
                    key={t}
                    className="rounded-[8px] bg-surface px-2 py-1 text-[11.5px] text-ink-body"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
    </div>
  );
}

function SourcesTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[720px] text-sm font-light leading-relaxed text-ink-faint">
        Mọi luật đều trỏ về một chỗ cụ thể trong sách để bạn tra lại được. Các cổ
        thư dưới đây đều được trích lại trong cuốn <em>Nhân Tướng Học</em> — ngữ
        liệu gốc của dự án.
      </p>
      {SOURCES.map((s) => {
        const used = RULES.filter((r) => r.source === s.id);
        return (
          <article
            key={s.id}
            className="flex flex-col gap-1.5 rounded-card border border-line-soft bg-card px-5 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-ink-title">{s.title}</h2>
              <span className="text-[12.5px] text-ink-faintest">
                {used.length > 0
                  ? `${used.length} luật dẫn nguồn này`
                  : "chưa luật nào dẫn"}
              </span>
            </div>
            <span className="text-[13px] text-ink-body">
              {s.author ? `${s.author} · ` : ""}
              {s.citation}
            </span>
            {s.note && (
              <p className="text-[13px] font-light leading-relaxed text-ink-muted">
                {s.note}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("rules");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:px-10 sm:py-16">
      <div className="flex flex-col gap-2">
        <span className="label-caps">Khám phá</span>
        <h1 className="text-3xl sm:text-4xl">Kho luận giải</h1>
        <p className="max-w-[700px] text-[15px] font-light leading-[1.75] text-ink-faint">
          Toàn bộ bộ luật mà ứng dụng dùng để đọc gương mặt: mỗi luật là một điều
          kiện trên một chỉ số, suy ra một nét tính cách, kèm{" "}
          <strong className="font-semibold text-ink-body">nguồn dẫn tra lại được</strong>.
          Không có luật nào chạy ngầm ngoài danh sách này.
        </p>
      </div>

      {/* Phân biệt hai lớp tin cậy — data/README.md, mục "tính trung thực". */}
      <aside
        role="note"
        className="rounded-card border border-line-soft bg-surface px-5 py-4 text-[12.5px] leading-relaxed text-ink-faintest"
      >
        <strong className="font-semibold text-ink-muted">
          Hai lớp thông tin, độ tin cậy khác nhau.
        </strong>{" "}
        Nét tính cách, mô tả và nguồn dẫn được lấy trực tiếp từ sách. Còn trọng số
        nhóm nghề (các con số 0–1 trong mỗi luật) là{" "}
        <strong className="font-semibold text-ink-muted">
          lớp diễn giải do nhóm dự án thêm vào
        </strong>{" "}
        — cổ thư nói về tính cách, không nói về nghề nghiệp hiện đại.
      </aside>

      <div role="tablist" aria-label="Nội dung tra cứu" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={
              "rounded-btn px-4 py-2.5 text-sm transition-colors " +
              (tab === t.key
                ? "bg-blue font-semibold text-white"
                : "border border-line-strong bg-card text-ink-body hover:border-blue hover:text-blue-deep")
            }
          >
            {t.label}{" "}
            <span className={tab === t.key ? "text-white/70" : "text-ink-faintest"}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "rules" && <RulesTab />}
      {tab === "faces" && <FacesTab />}
      {tab === "careers" && <CareersTab />}
      {tab === "sources" && <SourcesTab />}
    </main>
  );
}
