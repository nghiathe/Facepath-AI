"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RULES } from "@/lib/data";
import { SUPPORTED_KEYS } from "@/lib/engine/accessors";
import { evaluateRules } from "@/lib/engine/rule-engine";
import { aggregateTraits } from "@/lib/engine/traits";
import { TOTAL_LANDMARKS } from "@/lib/features/landmark-ids";
import { useScan } from "@/lib/session";

type Step = { label: string; done: boolean; ms: number | null };

// CLAUDE.md mục 11 màn 03. Con số hiển thị đều là số đo thật, không hard-code:
// mockup ghi "trung bình 12 giây" nhưng engine chạy hẳn trong máy nên chỉ mất
// vài mili-giây — hiện đúng số đo được thay vì bịa cho khớp mockup (mục 13).
export default function AnalyzePage() {
  const router = useRouter();
  const started = useRef(false);
  const [steps, setSteps] = useState<Step[]>([
    { label: `Chuẩn hoá ${TOTAL_LANDMARKS} điểm mốc`, done: false, ms: null },
    { label: `Bóc tách 4 lớp · ${SUPPORTED_KEYS.length} chỉ số`, done: false, ms: null },
    { label: "Truy hồi luật khớp trong ngữ liệu", done: false, ms: null },
    { label: "Sinh luận giải & bản đồ nhóm nghề", done: false, ms: null },
  ]);
  const scan = useScan();

  useEffect(() => {
    if (started.current || !scan) return;
    started.current = true;

    let cancelled = false;
    // Nhường một khung hình giữa các bước để người dùng thấy được tiến trình,
    // đồng thời đo đúng thời gian chạy thật của từng bước.
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

    (async () => {
      const mark = async (i: number, work: () => void) => {
        const t0 = performance.now();
        work();
        const ms = performance.now() - t0;
        if (cancelled) return;
        setSteps((prev) =>
          prev.map((s, k) => (k === i ? { ...s, done: true, ms } : s))
        );
        await frame();
      };

      await mark(0, () => void scan.landmarks?.length);
      await mark(1, () => void scan.features);
      let matched: ReturnType<typeof evaluateRules> = [];
      await mark(2, () => {
        matched = evaluateRules(scan.features, RULES);
      });
      await mark(3, () => void aggregateTraits(matched, RULES));

      if (!cancelled) router.replace("/result");
    })();

    return () => {
      cancelled = true;
    };
  }, [router, scan]);

  if (scan === null) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-16 sm:px-10">
        <span className="label-caps">Màn 03</span>
        <h1 className="text-3xl">Chưa có dữ liệu quét</h1>
        <p className="text-sm font-light text-ink-muted">
          Phiên này chưa có kết quả đo nào. Hãy quét gương mặt trước.
        </p>
        <Link
          href="/scan"
          className="w-fit rounded-btn bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy-deep"
        >
          Tới màn quét
        </Link>
      </main>
    );
  }

  const total = steps.reduce((s, x) => s + (x.ms ?? 0), 0);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16 sm:px-10">
      <span className="label-caps">Màn 03</span>
      <h1 className="text-3xl sm:text-4xl">Đang lập phiếu luận giải</h1>

      <div className="h-1 overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full bg-navy transition-all duration-200"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="flex flex-col">
        {steps.map((s) => (
          <li
            key={s.label}
            className="flex items-center gap-4 border-b border-line-soft py-3.5 last:border-0"
          >
            <span className={s.done ? "text-[#1E9B5B]" : "text-ink-faintest"}>
              {s.done ? "✓" : "○"}
            </span>
            <span
              className={
                "flex-1 text-[15px] " +
                (s.done ? "text-ink-body" : "font-light text-ink-faintest")
              }
            >
              {s.label}
            </span>
            <span className="text-xs tabular-nums text-ink-faintest">
              {s.ms === null ? "" : `${s.ms.toFixed(1)} ms`}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-ink-faintest">
        Toàn bộ tính toán chạy trong trình duyệt nên chỉ mất{" "}
        <strong className="font-semibold text-ink-muted">
          {total.toFixed(1)} ms
        </strong>
        , không phải chờ máy chủ.
      </p>
    </main>
  );
}
