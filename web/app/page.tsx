import Image from "next/image";
import Link from "next/link";

// Màn 01 — Landing (design/itde-tech-camp.html, CLAUDE.md mục 11).
// 478 là hằng số của MediaPipe Face Landmarker nên ghi thẳng được;
// các con số tính ra (% khớp, số luật, thời gian) thì tuyệt đối không hard-code.

const STATS = [
  { title: "478 điểm mốc", body: "MediaPipe Face Landmarker" },
  { title: "RAG + LLM", body: "Phân tích và tạo gợi ý" },
  { title: "Xử lý trên thiết bị", body: "Hình ảnh không được lưu trữ" },
] as const;

const STEPS = [
  {
    no: "01",
    icon: "◉",
    title: "Quét khuôn mặt",
    body: "Sử dụng camera để ghi nhận khuôn mặt.",
    warm: false,
  },
  {
    no: "02",
    icon: "◈",
    title: "AI phân tích",
    body: "Hệ thống nhận diện 478 điểm mốc khuôn mặt.",
    warm: false,
  },
  {
    no: "03",
    icon: "✦",
    title: "Khám phá kết quả",
    body: "Xem các nhóm nghề và lĩnh vực công nghệ được gợi ý.",
    warm: true,
  },
  {
    no: "04",
    icon: "⇄",
    title: "Lưu kết quả",
    body: "Lưu lại để xem và chia sẻ sau trải nghiệm.",
    warm: true,
  },
] as const;

export default function Home() {
  return (
    <main className="flex flex-col">
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,596px)_1fr]">
        {/* Cột chữ */}
        <div className="flex flex-col gap-10 px-6 py-12 sm:px-10 lg:py-14 lg:pl-10 lg:pr-12">
          <span className="label-caps text-[15px]">ITDE Tech Camp 2026</span>

          {/* Đúng 2 dòng, chia sẵn bằng hai span block chứ không để chữ tự
              xuống dòng. Cỡ chữ ở lg là 54px chứ không phải 58px như mockup:
              bản chữ mới dài hơn bản cũ ("Khám phá / hệ nghề của bạn"), mà cột
              trái chỉ rộng 596 - 40 - 48 = 508px. Đo bằng chính font Be Vietnam
              Pro SemiBold (tracking -0.035em): "công nghệ của bạn" chiếm
              516.1px ở 58px -> tràn thành 3 dòng, 498.3px ở 56px, 480.5px ở
              54px -> dư 27px. Đổi chữ dài hơn nữa thì phải đo lại, đừng tăng
              cỡ theo cảm tính. whitespace-nowrap chỉ bật từ sm: dưới ngưỡng đó
              cột còn hẹp hơn chính dòng chữ, khoá lại là chữ tràn ra ngoài. */}
          <h1 className="text-pretty text-4xl leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-[54px]">
            <span className="block sm:whitespace-nowrap">Khám phá dấu ấn</span>
            <span className="block sm:whitespace-nowrap">công nghệ của bạn</span>
          </h1>

          <p className="text-lg font-medium text-ink-body sm:text-[19px]">
            Một khuôn mặt — Một hành trình khám phá — Một góc nhìn mới về tương lai.
          </p>

          <p className="max-w-[470px] text-pretty text-[15.5px] font-light leading-[1.75] text-ink-faint">
            Chụp một bức ảnh và khám phá cách hệ thống ứng dụng{" "}
            <strong className="font-semibold text-ink-body">
              AI, Computer Vision và RAG
            </strong>{" "}
            để phân tích đặc điểm khuôn mặt, kết hợp với tri thức nhân tướng học
            nhằm đưa ra những{" "}
            <strong className="font-semibold text-ink-body">
              gợi ý thú vị về nhóm nghề và lĩnh vực công nghệ
            </strong>
            .
          </p>

          <div className="mt-1.5 flex flex-col items-stretch gap-3.5 sm:flex-row sm:items-center">
            <Link
              href="/scan"
              className="btn-primary inline-flex items-center justify-center gap-2.5 rounded-btn px-7 py-4 text-base font-semibold transition-[filter]"
            >
              Trải nghiệm ngay <span aria-hidden className="text-[17px]">→</span>
            </Link>
            <Link
              href="/result"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-btn border border-line-strong bg-card px-6 py-4 text-[15.5px] font-medium text-blue-deep transition-colors hover:border-blue"
            >
              Xem kết quả mẫu
            </Link>
          </div>

          <div className="mt-3 flex flex-col gap-2.5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-blue">
              Công nghệ phía sau trải nghiệm
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STATS.map(({ title, body }) => (
                <div
                  key={title}
                  className="flex flex-col gap-1 rounded-btn border border-line-soft bg-card px-4 py-3.5"
                >
                  <strong className="text-sm font-semibold text-ink-title">
                    {title}
                  </strong>
                  <span className="text-[11.5px] font-light text-ink-faint">{body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Khung hero — ô ảnh chân dung mà mockup chừa sẵn.
            ẢNH MINH HOẠ, không phải kết quả quét của ai: lớp lưới trên mặt là
            một phần của chính tấm ảnh. Nền chuyển sắc giữ nguyên bên dưới để
            khung không trắng bệch trong lúc ảnh đang tải. */}
        <div className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(150deg,#DCE6FF_0%,#C9D8FF_45%,#B7A7F5_100%)] lg:min-h-0">
          <Image
            src="/images/image.png"
            alt="Ảnh minh hoạ: khuôn mặt với lưới điểm mốc quét chồng lên"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
          {/* Vệt sáng mép trái: hoà ảnh vào nền trang thay vì cắt ngang đột ngột. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(242,246,255,0.92)_0%,rgba(242,246,255,0)_30%)] lg:block"
          />
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
            2026
          </div>
        </div>
      </section>

      {/* Dải "Cách thức trải nghiệm" — nền tối, dùng token on-dark-*.
          Mockup vẽ dải này cao đúng 128px, nhưng phần mô tả từng bước dài hơn
          một dòng nên dùng min-height: cao tối thiểu như mockup, và giãn ra
          thay vì cắt cụt chữ ở màn hẹp. */}
      <section className="bg-[linear-gradient(90deg,#0B1533_0%,#14265C_100%)] px-6 py-8 sm:px-10 lg:py-7">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:min-h-32 lg:flex-row lg:items-center lg:gap-0">
          <h2 className="w-[190px] flex-none text-xl font-semibold leading-tight text-on-dark">
            Cách thức
            <br className="hidden lg:inline" /> trải nghiệm
          </h2>
          <ol className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {STEPS.map(({ no, icon, title, body, warm }) => (
              <li
                key={no}
                className="flex items-start gap-3.5 lg:border-l lg:border-line-dark lg:pl-5"
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
                  <span className="text-xs font-light leading-relaxed text-on-dark-faint">
                    {body}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* KHÔNG có khối "Lưu ý" ở màn này — chủ dự án quyết bỏ ngày 10/09/2026,
          dù CLAUDE.md mục 1 xếp disclaimer màn 01 vào nguyên tắc bất di bất
          dịch. Bản đầy đủ vẫn nằm ở màn Phiếu kết quả và trang Về Tech Camp;
          đừng "sửa lại cho đúng đặc tả" nếu chưa hỏi. */}
    </main>
  );
}
