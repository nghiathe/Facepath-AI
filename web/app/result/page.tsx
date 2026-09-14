"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { formatSource } from "@/lib/data";
import { addHistory } from "@/lib/history";
import { DEMO_SCAN } from "@/lib/demo";
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

/**
 * Thanh % của một nhóm nghề, chạy từ 0 lên đúng giá trị khi thẻ hiện ra.
 *
 * Animate bằng `transform: scaleX` chứ không animate `width`: scaleX chạy trên
 * compositor, còn width thì mỗi khung đều bắt trình duyệt tính lại layout —
 * sáu thanh cùng chạy trên máy chiếu là thấy giật. Gốc biến đổi đặt ở mép trái
 * (origin-left) để thanh mọc từ trái sang.
 */
function CareerBar({ percent, lead }: { percent: number; lead: boolean }) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    // Đợi một khung hình rồi mới đổi scale, nếu không trình duyệt gộp hai
    // trạng thái vào cùng một lượt vẽ và thanh nhảy thẳng tới đích, mất hiệu ứng.
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-line-soft"
      // Thanh là hình ảnh của con số ngay bên cạnh, nên ẩn khỏi trình đọc màn
      // hình để không đọc lặp hai lần.
      aria-hidden
    >
      <div
        className={
          "h-full origin-left rounded-full transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
          (lead
            ? "bg-[linear-gradient(135deg,#2563EB,#6D4DF6)]"
            : "bg-[linear-gradient(135deg,rgba(37,99,235,0.45),rgba(109,77,246,0.45))]")
        }
        style={{
          width: `${percent}%`,
          transform: `scaleX(${grown ? 1 : 0})`,
          // Nhóm sau chạy trễ hơn nhóm trước một nhịp -> bảng xếp hạng "đổ"
          // xuống theo thứ tự thay vì bung ra cùng lúc.
          transitionDelay: lead ? "80ms" : "160ms",
        }}
      />
    </div>
  );
}

function ResultView() {
  // `?demo=1` -> dựng phiếu từ lib/demo.ts thay vì từ phiên quét. Đây là đường
  // đi của nút "Xem kết quả mẫu" ở trang chủ: người mới vào chưa quét gì mà
  // bấm thì vẫn phải thấy một phiếu đầy đủ, không phải màn hình trống.
  const isDemo = useSearchParams().get("demo") !== null;
  const live = useScan();
  const scan = isDemo ? DEMO_SCAN : live;
  const [showLayers, setShowLayers] = useState(true);
  const [imgReady, setImgReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const result: AnalysisResult | null = useMemo(
    () => (scan ? analyzeFeatures(scan.features) : null),
    [scan]
  );

  // Ghi lượt quét vào lịch sử trên máy (lib/history.ts). Khoá là mốc thời gian
  // của lượt quét nên mở lại phiếu cũ chỉ ghi đè đúng mục đó, không nhân bản.
  // KHÔNG lưu ảnh: lịch sử sống lâu dài trên máy, có thể là máy dùng chung.
  //
  // Phiếu mẫu thì KHÔNG ghi: nó không phải lượt quét của ai. Ở hội trại, máy
  // chiếu bấm "Xem kết quả mẫu" cả chục lần trong buổi, ghi hết thì lịch sử
  // của người dùng thật bị phiếu mẫu đẩy rơi hết ra ngoài (MAX_ENTRIES).
  useEffect(() => {
    if (isDemo || !scan || !result) return;
    addHistory({
      at: scan.at,
      archetype: result.archetype,
      ducTinh: result.faceType.duc_tinh,
      matchedRulesCount: result.matchedRulesCount,
      totalRulesCount: result.totalRulesCount,
      sourcesCount: result.sourcesCount,
      lead: result.careers[0]
        ? {
            slug: result.careers[0].slug,
            name: result.careers[0].name,
            percent: result.careers[0].percent,
          }
        : null,
      traits: result.traits.slice(0, 3).map((t) => t.label),
      features: result.features,
      landmarks: scan.landmarks,
    });
  }, [isDemo, scan, result]);

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
      </main>
    );
  }

  const lead = result.careers[0];

  return (
    <main className="mx-auto flex w-full max-w-380 flex-col gap-6 px-6 py-10 print:py-0 sm:px-10">
      {/* Phiếu mẫu phải tự giới thiệu là phiếu mẫu, ngay dòng đầu. Chiếu lên
          màn lớn mà không có dòng này thì cả hội trường tưởng đó là kết quả
          của người vừa đứng trước camera. */}
      {isDemo && (
        <div className="reveal flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-blue/25 bg-blue/6 px-5 py-3.5 text-[13px] text-ink-body">
          <strong className="font-semibold text-blue-deep">Đây là phiếu mẫu.</strong>
          <span className="text-ink-muted">
            Các chỉ số bên dưới là một bộ số dựng sẵn, không phải gương mặt của
            ai. Kiểu tướng, luật khớp và % nghề vẫn do engine tính thật từ bộ số
            đó.
          </span>
          <Link
            href="/scan"
            className="ml-auto whitespace-nowrap font-semibold text-blue-deep underline-offset-2 hover:underline"
          >
            Quét gương mặt của bạn →
          </Link>
        </div>
      )}

      {/* Tiêu đề */}
      <div className="reveal flex flex-col gap-4 border-b border-line-soft pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="label-caps text-amber-text">
            {isDemo ? "Phiếu mẫu" : "Phiếu luận giải"} ·{" "}
            {new Date(scan.at).toLocaleDateString("vi-VN")}
          </span>
          <h1 className="text-3xl sm:text-[32px]">{result.archetype}</h1>
          <span className="text-sm font-light text-ink-muted">
            {result.matchedRulesCount}/{result.totalRulesCount} luật khớp ·{" "}
            {result.sourcesCount} nguồn dẫn · đức {result.faceType.duc_tinh}
          </span>
        </div>
        {/* Khối "dẫn đầu" nổi lên bằng nền dải màu nhạt — trên máy chiếu, chỉ
            đổi cỡ chữ thì từ cuối hội trường không thấy đâu là điểm chính. */}
        <div className="scale-in flex flex-col gap-0.5 rounded-card border border-blue/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.09),rgba(109,77,246,0.09))] px-5 py-3.5 sm:text-right">
          <span className="text-xs text-ink-faintest">Nhóm nghề dẫn đầu</span>
          <strong className="gradient-text text-xl font-semibold">{lead.name}</strong>
          <span className="text-sm font-semibold text-amber-text">
            {lead.percent}% mức khớp đặc điểm
          </span>
        </div>
      </div>

      {/* 4 cột trên màn rộng: ảnh · luận giải · nét tính cách · nhóm nghề.
          Dưới xl chỉ còn 2 cột (và 1 cột trên mobile) — nhồi 4 cột vào bề ngang
          laptop thì cột luận giải hẹp tới mức mỗi dòng còn dăm chữ. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-[280px_minmax(0,1fr)_290px_290px]">
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
              /* Không có ảnh: phiếu mở lại từ lịch sử (lịch sử cố ý không lưu
                 ảnh), hoặc ảnh quá lớn không nhét vừa sessionStorage. Còn toạ
                 độ điểm mốc thì vẫn vẽ được lớp bóc tách lên nền tối này. */
              <div className="relative flex aspect-3/4 flex-col items-center justify-center gap-3 overflow-hidden p-6 text-center">
                {/* Ô này hay trống trơn (phiếu mẫu, hoặc phiếu mở lại từ lịch
                    sử). Trên máy chiếu một ô đen trơn nhìn như ảnh tải lỗi, nên
                    cho nó một nền chuyển sắc + vạch quét để đọc ra là "cố ý
                    không có ảnh". */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#16295E,#0A1330_60%,#060C22)]"
                />
                <div aria-hidden className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-full animate-[fp-sweep_5s_ease-in-out_infinite]">
                    <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(110,168,255,0.6),transparent)]" />
                  </div>
                </div>
                <span aria-hidden className="relative text-2xl text-sky/70">
                  ◍
                </span>
                <span className="relative text-xs leading-relaxed text-white/55">
                  {scan.landmarks
                    ? "Phiếu này không kèm ảnh — chỉ còn lớp bóc tách."
                    : "Phiếu này chỉ có các chỉ số, không kèm ảnh hay điểm mốc."}
                </span>
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
            {scan.snapshot
              ? "Ảnh chỉ nằm trong tab trình duyệt của bạn và mất khi đóng tab. Không bản sao nào được gửi lên máy chủ."
              : "Phiếu này không kèm ảnh — chỉ còn lớp bóc tách và các chỉ số. Lịch sử quét cố ý không lưu ảnh."}
          </p>
        </div>

        {/* Cột 2: luận giải */}
        <div className="flex flex-col gap-5 xl:border-l xl:border-line-soft xl:pl-8">
          <span className="label-caps">Luận giải</span>
          <p className="text-pretty text-[15px] font-light leading-[1.75] text-ink-body">
            {result.reading}
          </p>
        </div>

        {/* Cột 3: nét tính cách & nguồn dẫn */}
        <div className="flex flex-col gap-4 xl:border-l xl:border-line-soft xl:pl-8">
          <span className="label-caps">Nét tính cách &amp; nguồn dẫn</span>
          <div className="flex flex-col gap-3">
            {result.traits.map((t, i) => (
              <div
                key={t.slug}
                className={`reveal d-${Math.min(i + 1, 6)} flex gap-3`}
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm bg-[linear-gradient(135deg,#2563EB,#6D4DF6)]" />
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

        {/* Cột 4: nhóm nghề */}
        <div className="flex flex-col gap-4 xl:border-l xl:border-line-soft xl:pl-8">
          <span className="label-caps">Nhóm nghề phù hợp</span>
          {result.careers.map((c, i) => (
            <div
              key={c.slug}
              className={`reveal d-${Math.min(i + 1, 6)} flex flex-col gap-1.5`}
            >
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
                    "shrink-0 font-semibold tabular-nums " +
                    (i === 0 ? "text-blue-deep" : "text-ink-muted")
                  }
                >
                  {c.percent}%
                </span>
              </div>
              {/* Trước đây thanh này tô #232B76 — navy của bảng màu cũ đã bỏ
                  (CLAUDE.md mục 5). Giờ dùng đúng dải xanh->tím của thiết kế. */}
              <CareerBar percent={c.percent} lead={i === 0} />
              <span className="text-[11.5px] font-light leading-snug text-ink-faintest">
                {c.sample_jobs} · {c.matchedRules} đặc điểm
              </span>
            </div>
          ))}

          
        </div>
      </div>


      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <button
          onClick={() => window.print()}
          className="btn-primary rounded-btn px-6 py-3 text-sm font-semibold"
        >
          Tải PDF
        </button>
        <Link
          href="/scan"
          className="rounded-btn border border-line-strong px-6 py-3 text-center text-sm text-blue-deep transition-all duration-300 hover:-translate-y-0.5 hover:border-blue hover:shadow-[0_14px_28px_-18px_rgba(37,99,235,0.7)]"
        >
          Quét lại
        </Link>
        <Link
          href="/history"
          className="rounded-btn px-6 py-3 text-center text-sm text-ink-faint transition-colors hover:text-blue-deep"
        >
          Xem Lịch sử quét →
        </Link>
      </div>
    </main>
  );
}

// useSearchParams() bắt buộc phải nằm dưới một ranh giới Suspense, nếu không
// Next.js không dựng tĩnh được trang này (build sẽ báo lỗi thẳng). Fallback chỉ
// tồn tại trong tích tắc trước khi tham số URL đọc được.
export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
          <p className="text-sm text-ink-faintest">Đang mở phiếu…</p>
        </main>
      }
    >
      <ResultView />
    </Suspense>
  );
}
