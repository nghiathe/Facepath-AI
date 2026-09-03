"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { formatSource } from "@/lib/data";
import { analyzeFeatures, type AnalysisResult } from "@/lib/engine/analyze";
import { ALL_LAYERS, drawOverlay, LAYER_COLORS } from "@/lib/features/overlay";
import type { FaceFeatures } from "@/lib/features/types";
import { useScan } from "@/lib/session";

// Nhãn đặc trưng hiện cạnh ảnh (CLAUDE.md mục 11 màn 04).
const LABELS = (f: FaceFeatures) =>
  [
    { color: LAYER_COLORS.face, name: "Đường viền dáng mặt", value: f.faceType },
    {
      color: LAYER_COLORS.santing,
      name: "Tam đình (3 tầng mặt)",
      value:
        `${Math.round(f.santing.upper * 100)}/${Math.round(f.santing.middle * 100)}/` +
        `${Math.round(f.santing.lower * 100)}`,
    },
    { color: LAYER_COLORS.brow, name: "Cung mày", value: f.eyebrows.curvature.toFixed(2) },
    { color: LAYER_COLORS.nose, name: "Cánh mũi", value: f.nose.wingWidth.toFixed(2) },
    { color: LAYER_COLORS.mouth, name: "Khoé miệng", value: f.mouth.width.toFixed(2) },
  ] as const;

export default function ResultPage() {
  const scan = useScan();
  const [showLayers, setShowLayers] = useState(true);
  const [imgReady, setImgReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const result: AnalysisResult | null = useMemo(
    () => (scan ? analyzeFeatures(scan.features) : null),
    [scan]
  );

  // Vẽ lớp bóc tách khi ảnh đã tải xong hoặc khi bật/tắt lớp.
  useEffect(() => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !scan?.landmarks) return;
    const w = img?.clientWidth || c.clientWidth || 300;
    const h = img?.clientHeight || c.clientHeight || 384;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (showLayers) drawOverlay(ctx, scan.landmarks, w, h, ALL_LAYERS);
    else ctx.clearRect(0, 0, w, h);
  }, [scan, showLayers, imgReady]);

  if (scan === undefined) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
        <p className="text-sm text-ink-faintest">Đang mở phiếu…</p>
      </main>
    );
  }

  if (!scan || !result) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-16 sm:px-10">
        <span className="label-caps">Màn 04</span>
        <h1 className="text-3xl">Chưa có phiếu nào</h1>
        <p className="text-sm font-light text-ink-muted">
          Phiên này chưa có kết quả quét. Quét gương mặt để lập phiếu luận giải.
        </p>
        <Link
          href="/scan"
          className="w-fit rounded-btn bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy-deep"
        >
          Bắt đầu quét
        </Link>
        <DisclaimerBanner />
      </main>
    );
  }

  const lead = result.careers[0];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 print:py-0 sm:px-10">
      {/* Tiêu đề */}
      <div className="flex flex-col gap-4 border-b border-line-soft pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="label-caps text-amber-text">
            Phiếu luận giải ·{" "}
            {new Date(scan.at).toLocaleDateString("vi-VN")}
          </span>
          <h1 className="text-3xl sm:text-[32px]">{result.archetype}</h1>
          <span className="text-sm font-light text-ink-muted">
            {result.matchedRulesCount}/{result.totalRulesCount} luật khớp ·{" "}
            {result.sourcesCount} nguồn dẫn · đức {result.faceType.duc_tinh}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 sm:text-right">
          <span className="text-xs text-ink-faintest">Nhóm nghề dẫn đầu</span>
          <strong className="text-xl font-semibold text-navy">{lead.name}</strong>
          <span className="text-sm font-semibold text-amber-text">
            {lead.percent}% mức khớp đặc điểm
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr_300px]">
        {/* Cột trái: ảnh + lớp bóc tách */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="label-caps">Ảnh đã chụp</span>
            <button
              onClick={() => setShowLayers((v) => !v)}
              className="text-xs text-navy underline-offset-2 hover:underline print:hidden"
            >
              {showLayers ? "Tắt lớp bóc tách" : "Bật lớp bóc tách"}
            </button>
          </div>

          <div className="relative overflow-hidden rounded-card bg-navy-darkest">
            {scan.snapshot ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                ref={imgRef}
                src={scan.snapshot}
                alt="Ảnh gương mặt đã chụp, chỉ lưu trong phiên này"
                className="block w-full"
                onLoad={() => setImgReady(true)}
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center p-6 text-center text-xs text-white/50">
                Không lưu được ảnh trong phiên này. Các chỉ số vẫn đầy đủ.
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
            {LABELS(result.features).map((l) => (
              <div key={l.name} className="flex items-center gap-2.5">
                <span
                  className="h-[3px] w-4 shrink-0 rounded-sm"
                  style={{ background: l.color }}
                />
                <span className="flex-1 text-[13px] text-ink-body">{l.name}</span>
                <span className="text-xs font-semibold text-navy">{l.value}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] leading-relaxed text-ink-faintest">
            Ảnh chỉ nằm trong tab trình duyệt của bạn và mất khi đóng tab. Không
            bản sao nào được gửi lên máy chủ.
          </p>
        </div>

        {/* Cột giữa: luận giải + trait */}
        <div className="flex flex-col gap-5 lg:border-x lg:border-line-soft lg:px-8">
          <span className="label-caps">Luận giải</span>
          <p className="text-pretty text-[15px] font-light leading-[1.75] text-ink-body">
            {result.reading}
          </p>

          <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
            <span className="label-caps">Nét tính cách &amp; nguồn dẫn</span>
            {result.traits.map((t) => (
              <div key={t.slug} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm bg-amber" />
                <div className="flex flex-col gap-0.5">
                  <strong className="text-sm font-semibold text-ink-title">
                    {t.label}
                  </strong>
                  <span className="text-[13px] font-light leading-relaxed text-ink-muted">
                    {t.rules[0].hint} ·{" "}
                    <em className="not-italic text-amber-text">
                      {formatSource(t.rules[0].source, t.rules[0].citation)}
                    </em>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cột phải: nhóm nghề */}
        <div className="flex flex-col gap-4">
          <span className="label-caps">Nhóm nghề phù hợp</span>
          {result.careers.map((c, i) => (
            <div key={c.slug} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span
                  className={
                    i === 0 ? "font-semibold text-ink-title" : "text-ink-body"
                  }
                >
                  {c.name}
                </span>
                <span
                  className={
                    "shrink-0 font-semibold " +
                    (i === 0 ? "text-navy" : "text-ink-muted")
                  }
                >
                  {c.percent}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${c.percent}%`,
                    background: i === 0 ? "#232B76" : "rgba(35,43,118,0.45)",
                  }}
                />
              </div>
              <span className="text-[11.5px] font-light leading-snug text-ink-faintest">
                {c.sample_jobs} · {c.matchedRules} luật khớp
              </span>
            </div>
          ))}

          <div className="mt-2 rounded-card bg-surface px-4 py-3">
            <strong className="text-[13px] font-semibold text-ink-title">
              Nếu học tại Học viện Ngân hàng
            </strong>
            <p className="mt-1 text-[12.5px] font-light leading-relaxed text-ink-body">
              Nhóm dẫn đầu là {lead.name.toLowerCase()} — tham khảo các học phần
              gần hướng này khi chọn chuyên ngành và môn tự chọn.
            </p>
          </div>
        </div>
      </div>

      <DisclaimerBanner />

      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-btn bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy-deep"
        >
          Tải PDF
        </button>
        <Link
          href="/scan"
          className="rounded-btn border border-line-strong px-6 py-3 text-center text-sm text-navy hover:border-navy"
        >
          Quét lại
        </Link>
      </div>
    </main>
  );
}
