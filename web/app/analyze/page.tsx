"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RULES } from "@/lib/data";
import { SUPPORTED_KEYS } from "@/lib/engine/accessors";
import { evaluateRules } from "@/lib/engine/rule-engine";
import { aggregateTraits } from "@/lib/engine/traits";
import { TOTAL_LANDMARKS } from "@/lib/features/landmark-ids";
import { useScan } from "@/lib/session";

type State = "pending" | "running" | "done";
type Step = {
  label: string;
  note: string;
  state: State;
  ms: number | null;
  /**
   * Bước này có thật sự chạy phép tính ở màn NÀY không.
   *
   * Hai bước đầu thì KHÔNG: việc chuẩn hoá điểm mốc và bóc tách chỉ số đã chạy
   * xong ở màn 02 rồi (extractFeatures gọi ngay lúc chụp), tới đây chỉ còn đọc
   * lại kết quả có sẵn. Liệt kê chúng ra là để giải thích đường đi của dữ liệu
   * cho người xem, nhưng đo thời gian của một phép gán rồi in "0.0 ms" thì
   * thành ra khoe một con số không có thật — và cả bốn dòng cùng hiện 0.0 ms
   * chỉ làm người xem tưởng màn hình bị lỗi. Bước không đo thì nói thẳng là nó
   * đã xong từ trước.
   */
  measured: boolean;
};

/** ms rất nhỏ mà toFixed(1) thì ra "0.0" — vô nghĩa. Giữ đủ chữ số có nghĩa. */
const fmtMs = (ms: number) => (ms < 1 ? ms.toFixed(2) : ms.toFixed(1));

/**
 * Thời gian hiển thị tối thiểu của MỖI bước, tính bằng ms.
 *
 * Engine chạy hẳn trong máy nên cả 4 bước cộng lại chỉ vài mili-giây — nhanh
 * tới mức màn này loé qua trước khi kịp đọc một chữ. Ở hội trại thì chính 4
 * bước này là thứ giải thích cho người xem ứng dụng đang làm gì, nên mỗi bước
 * được giữ lại trên màn đủ lâu để đọc.
 *
 * ĐÂY LÀ NHỊP TRÌNH BÀY, KHÔNG PHẢI THỜI GIAN TÍNH TOÁN. Con số ms hiện bên
 * phải các bước `measured` vẫn là thời gian chạy THẬT của bước đó (đo bằng
 * performance.now quanh đúng phần việc), và dòng tổng kết dưới cùng cũng vậy —
 * mockup ghi "trung bình 12 giây" nhưng bịa ra 12 giây cho khớp mockup là vi
 * phạm CLAUDE.md mục 13. Đừng gộp hai con số này làm một.
 */
const STEP_MIN_MS = 700;

export default function AnalyzePage() {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([
    {
      label: `Chuẩn hoá ${TOTAL_LANDMARKS} điểm mốc`,
      note: "Quy toạ độ về tỉ lệ bất biến với khoảng cách tới camera",
      state: "pending",
      ms: null,
      measured: false,
    },
    {
      label: `Bóc tách 4 lớp · ${SUPPORTED_KEYS.length} chỉ số`,
      note: "Dáng mặt & tam đình · cung mày · mũi · miệng",
      state: "pending",
      ms: null,
      measured: false,
    },
    {
      label: "Truy hồi luật khớp trong ngữ liệu",
      note: `Đối chiếu với ${RULES.length} luật soạn từ cổ thư`,
      state: "pending",
      ms: null,
      measured: true,
    },
    {
      label: "Sinh luận giải & bản đồ nhóm nghề",
      note: "Gom nét tính cách kèm nguồn dẫn, chấm điểm 6 nhóm nghề",
      state: "pending",
      ms: null,
      measured: true,
    },
  ]);
  const scan = useScan();

  useEffect(() => {
    if (!scan) return;

    // KHÔNG dùng ref kiểu `started` để chặn chạy lặp: StrictMode ở dev cố ý
    // mount → unmount → mount lại, mà ref thì sống sót qua lần remount đó còn
    // `cancelled` thì không. Hệ quả là lần chạy đầu bị huỷ giữa chừng (kẹt ở
    // bước 1, không điều hướng), còn lần mount thứ hai lại bị chính ref chặn
    // nên không có ai chạy tiếp. Cứ để mỗi lần mount chạy một lượt của riêng
    // nó; `cancelled` bên dưới lo việc bỏ kết quả của lượt cũ.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Nhường một khung hình để trạng thái vừa đặt kịp lên màn trước khi chạy
    // tiếp — cũng là cách đo đúng thời gian chạy thật của từng bước.
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    const wait = (ms: number) =>
      new Promise((r) => {
        timer = setTimeout(r, ms);
      });

    (async () => {
      const mark = async (i: number, work: () => void) => {
        setSteps((prev) =>
          prev.map((s, k) => (k === i ? { ...s, state: "running" } : s))
        );
        await frame();

        const t0 = performance.now();
        work();
        const ms = performance.now() - t0;

        // Giữ bước trên màn cho đủ STEP_MIN_MS kể từ lúc nó sáng lên. Trừ đi
        // phần đã tiêu cho chính phần việc, nên bước nào lỡ chạy lâu thật thì
        // không bị cộng thêm thời gian chờ vô ích.
        const rest = STEP_MIN_MS - ms;
        if (rest > 0) await wait(rest);
        if (cancelled) return;

        setSteps((prev) =>
          prev.map((s, k) => (k === i ? { ...s, state: "done", ms } : s))
        );
        await frame();
      };

      await mark(0, () => void scan.landmarks?.length);
      if (cancelled) return;
      await mark(1, () => void scan.features);
      if (cancelled) return;
      let matched: ReturnType<typeof evaluateRules> = [];
      await mark(2, () => {
        matched = evaluateRules(scan.features, RULES);
      });
      if (cancelled) return;
      await mark(3, () => void aggregateTraits(matched, RULES));

      if (!cancelled) router.replace("/result");
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
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
          className="btn-primary w-fit rounded-btn px-6 py-3 text-sm font-semibold"
        >
          Tới màn quét
        </Link>
      </main>
    );
  }

  // Chỉ cộng các bước thật sự chạy phép tính ở màn này — xem Step.measured.
  const total = steps.reduce((s, x) => s + (x.measured ? (x.ms ?? 0) : 0), 0);
  const doneCount = steps.filter((s) => s.state === "done").length;
  const allMeasured = steps.every((s) => !s.measured || s.state === "done");

  return (
    <main className="relative mx-auto flex max-w-3xl flex-col gap-7 px-6 py-16 sm:px-10">
      {/* Quầng sáng nhè nhẹ phía sau, để màn chờ không trống trải khi phóng to. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.14),transparent_70%)] blur-3xl animate-[fp-aurora_20s_ease-in-out_infinite]"
      />

      <div className="reveal flex flex-col gap-2">
        <span className="label-caps">Màn 03</span>
        <h1 className="text-3xl sm:text-4xl">Đang lập phiếu luận giải</h1>

      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-line-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        aria-label="Tiến trình lập phiếu"
      >
        <div
          className="h-full origin-left rounded-full bg-[linear-gradient(90deg,#2563EB,#6D4DF6,#38BDF8)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `scaleX(${doneCount / steps.length})`, width: "100%" }}
        />
      </div>

      <ul className="flex flex-col">
        {steps.map((s) => (
          <li
            key={s.label}
            className={
              "flex items-start gap-4 border-b border-line-soft py-4 transition-opacity duration-500 last:border-0 " +
              (s.state === "pending" ? "opacity-45" : "opacity-100")
            }
          >
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center">
              {s.state === "done" ? (
                <span className="scale-in text-[#1E9B5B]">✓</span>
              ) : s.state === "running" ? (
                <span
                  aria-hidden
                  className="h-4 w-4 animate-[fp-spin_0.8s_linear_infinite] rounded-full border-2 border-blue/25 border-t-blue"
                />
              ) : (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-faintest" />
              )}
            </span>

            <div className="flex flex-1 flex-col gap-0.5">
              <span
                className={
                  "text-[15px] transition-colors duration-300 " +
                  (s.state === "pending"
                    ? "font-light text-ink-faintest"
                    : s.state === "running"
                      ? "font-semibold text-blue-deep"
                      : "text-ink-body")
                }
              >
                {s.label}
              </span>
              <span className="text-[12.5px] font-light leading-relaxed text-ink-faintest">
                {s.note}
              </span>
            </div>

            <span className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-ink-faintest">
              {s.state !== "done"
                ? ""
                : s.measured
                  ? `${fmtMs(s.ms ?? 0)} ms`
                  : "đã xong ở màn quét"}
            </span>
          </li>
        ))}
      </ul>

      {/* Chỉ công bố con số khi đã đo xong. Hiện "mất 0.00 ms" trong lúc hai
          bước đó còn chưa chạy là nói một điều chưa đúng ở thì quá khứ. */}
    </main>
  );
}
