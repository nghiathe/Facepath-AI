import Link from "next/link";
import DisclaimerBanner from "@/components/DisclaimerBanner";

// Màn 01 — Landing (design/itde-tech-camp.html, CLAUDE.md mục 11).
// 478 là hằng số của MediaPipe Face Landmarker nên ghi thẳng được;
// các con số tính ra (% khớp, số luật, thời gian) thì tuyệt đối không hard-code.

const STATS = [
  { title: "478 điểm mốc", body: "MediaPipe Face Landmarker" },
  { title: "RAG + LLM", body: "Phân tích & gợi ý thông minh" },
  { title: "Hoàn toàn cục bộ", body: "Không lưu trữ hình ảnh" },
] as const;

const STEPS = [
  { no: "01", icon: "◉", title: "Quét khuôn mặt", body: "Bằng camera", warm: false },
  { no: "02", icon: "◈", title: "AI phân tích", body: "478 điểm mốc", warm: false },
  { no: "03", icon: "✦", title: "Khám phá kết quả", body: "Nhóm nghề phù hợp", warm: true },
  { no: "04", icon: "⇄", title: "Lưu lại kết quả", body: "Xem lại bất cứ lúc nào", warm: true },
] as const;

/** Lưới điểm mốc trang trí ở khung hero — gợi hình 478 điểm, không phải dữ liệu thật. */
function FaceMeshMark() {
  const dots = [
    [112, 96], [150, 88], [188, 98],
    [98, 140], [150, 132], [202, 142],
    [118, 184], [150, 196], [182, 184],
    [132, 228], [168, 228],
  ];
  return (
    <svg viewBox="0 0 300 300" className="h-full w-full" aria-hidden>
      {/* 4 góc khung ngắm */}
      <g fill="none" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round">
        <path d="M14 84 L14 14 L84 14" />
        <path d="M216 14 L286 14 L286 84" />
        <path d="M286 216 L286 286 L216 286" />
        <path d="M84 286 L14 286 L14 216" />
      </g>
      <g stroke="rgba(224,242,254,0.55)" strokeWidth="1" fill="none">
        <path d="M112 96 L150 88 L188 98 M98 140 L150 132 L202 142 M118 184 L150 196 L182 184 M132 228 L168 228" />
        <path d="M112 96 L98 140 L118 184 L132 228 M188 98 L202 142 L182 184 L168 228 M150 88 L150 132 L150 196" />
      </g>
      <g opacity="0.85" fill="#E0F2FE">
        {dots.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" />
        ))}
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <main className="flex flex-col">
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,596px)_1fr]">
        {/* Cột chữ */}
        <div className="flex flex-col gap-5 px-6 py-12 sm:px-10 lg:py-14 lg:pl-10 lg:pr-12">
          <span className="label-caps text-[15px]">ITDE Tech Camp 2027</span>

          <h1 className="text-pretty text-4xl leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-[58px]">
            Khám phá
            <br />
            hệ nghề của bạn
          </h1>

          <p className="text-lg font-medium text-ink-body sm:text-[19px]">
            Gương mặt công nghệ — Tương lai trong tay bạn!
          </p>

          <p className="max-w-[470px] text-pretty text-[15.5px] font-light leading-[1.75] text-ink-faint">
            Chỉ với một bức ảnh khuôn mặt, hệ thống phân tích 478 điểm mốc{" "}
            <strong className="font-semibold text-ink-body">
              ngay trên thiết bị của bạn
            </strong>{" "}
            và gợi ý nhóm nghề, lĩnh vực công nghệ phù hợp nhất.
          </p>

          <div className="mt-1.5 flex flex-col items-stretch gap-3.5 sm:flex-row sm:items-center">
            <Link
              href="/scan"
              className="btn-primary inline-flex items-center justify-center gap-2.5 rounded-btn px-7 py-4 text-base font-semibold transition-[filter]"
            >
              Bắt đầu trải nghiệm <span aria-hidden className="text-[17px]">→</span>
            </Link>
            <Link
              href="/result"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-btn border border-line-strong bg-card px-6 py-4 text-[15.5px] font-medium text-blue-deep transition-colors hover:border-blue"
            >
              Xem phiếu mẫu
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STATS.map(({ title, body }) => (
              <div
                key={title}
                className="flex flex-col gap-1 rounded-btn border border-line-soft bg-card px-4 py-3.5"
              >
                <strong className="text-sm font-semibold text-ink-title">{title}</strong>
                <span className="text-[11.5px] font-light text-ink-faint">{body}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Khung hero. Mockup có ô kéo-thả ảnh chân dung; chưa có ảnh nên để
            nguyên nền chuyển sắc + lưới điểm mốc. Muốn thêm thì đặt ảnh vào
            public/images/ rồi lồng <Image fill> vào đúng div này. */}
        <div className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(150deg,#DCE6FF_0%,#C9D8FF_45%,#B7A7F5_100%)] lg:min-h-0">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(242,246,255,0.9)_0%,rgba(242,246,255,0)_32%)] lg:block"
          />
          <div className="pointer-events-none absolute left-1/2 top-14 h-[240px] w-[240px] -translate-x-1/2 sm:h-[300px] sm:w-[300px] lg:-translate-x-[46%]">
            <FaceMeshMark />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute right-8 top-10 text-right text-[15px] font-semibold leading-[1.7] tracking-[0.24em] text-white [text-shadow:0_2px_12px_rgba(14,26,60,0.45)]"
          >
            ITDE
            <br />
            TECH
            <br />
            CAMP
            <br />
            2027
          </div>
        </div>
      </section>

      {/* Dải "Cách thức tham gia" — nền tối, dùng token on-dark-* */}
      <section className="bg-[linear-gradient(90deg,#0B1533_0%,#14265C_100%)] px-6 py-8 sm:px-10 lg:py-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:h-32 lg:flex-row lg:items-center lg:gap-0">
          <h2 className="w-[190px] flex-none text-xl font-semibold leading-tight text-on-dark">
            Cách thức
            <br className="hidden lg:inline" /> tham gia
          </h2>
          <ol className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {STEPS.map(({ no, icon, title, body, warm }) => (
              <li
                key={no}
                className="flex items-center gap-3.5 lg:border-l lg:border-line-dark lg:pl-6"
              >
                <span
                  aria-hidden
                  className={
                    "inline-flex h-11 w-11 flex-none items-center justify-center rounded-btn border text-lg " +
                    (warm
                      ? "border-violet-light/40 bg-violet-light/20 text-[#C4B5FD]"
                      : "border-sky/35 bg-blue/20 text-[#93C5FD]")
                  }
                >
                  {icon}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={
                      "text-xs font-bold tracking-[0.1em] " +
                      (warm ? "text-amber-text" : "text-sky")
                    }
                  >
                    {no}
                  </span>
                  <strong className="text-[14.5px] font-semibold text-on-dark">
                    {title}
                  </strong>
                  <span className="text-xs font-light text-on-dark-faint">{body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Mockup mới bỏ mất disclaimer ở màn Landing; CLAUDE.md mục 1 xếp nó vào
          nguyên tắc bất di bất dịch nên giữ lại. */}
      <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
        <DisclaimerBanner />
      </div>
    </main>
  );
}
