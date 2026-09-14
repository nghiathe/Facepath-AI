import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import StartScanButton from "@/components/StartScanButton";

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
    /* Trang chủ chiếm trọn một màn hình: cao bằng khung nhìn trừ header
       (h-20 + viền 1px ở mobile, h-26 + 1px từ sm:). Không khoá chiều cao thì
       nội dung kết thúc lưng chừng và dưới dải "Cách thức trải nghiệm" còn một
       khoảng trắng thừa — chiếu lên máy chiếu là thấy ngay trang bị hụt.
       Dùng svh chứ không phải vh: trên trình duyệt di động vh tính cả phần bị
       thanh địa chỉ che, lấy vh là dải nền tối bị đẩy khuất dưới mép màn. */
    <main className="flex min-h-[calc(100svh-5rem-1px)] flex-col sm:min-h-[calc(100svh-6.5rem-1px)]">
      {/* flex-1: phần dư của khung nhìn dồn hết vào hero, nên hero giãn ra cho
          vừa màn thay vì để trang hụt ở đáy. */}
      <section className="relative grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,596px)_1fr]">
        {/* Hai quầng sáng trôi rất chậm phía sau cột chữ — chỉ để nền sáng
            #F2F6FF không phẳng lì khi phóng lên màn chiếu lớn. Đặt blur rất
            mạnh và độ mờ thấp: thấy được là chuyển sắc chứ không thấy ra hình
            tròn. pointer-events-none để không nuốt cú bấm vào nút bên dưới. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.16),transparent_68%)] blur-3xl animate-[fp-aurora_22s_ease-in-out_infinite]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 left-24 h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(109,77,246,0.14),transparent_68%)] blur-3xl animate-[fp-aurora_28s_ease-in-out_infinite_reverse]"
        />

        {/* Cột chữ. lg:justify-center — khi hero giãn ra cho đủ chiều cao màn
            hình, phần dư chia đều trên/dưới khối chữ; bỏ nó thì chữ dính lên
            mép trên còn khoảng trống dồn hết xuống dưới nút bấm. */}
        <div className="relative flex flex-col gap-10 px-6 py-12 sm:px-10 lg:justify-center lg:py-14 lg:pl-10 lg:pr-12">
          <span className="label-caps reveal text-[15px]">ITDE Tech Camp 2026</span>

          {/* Đúng 2 dòng, chia sẵn bằng hai span block chứ không để chữ tự
              xuống dòng. Cỡ chữ ở lg là 54px chứ không phải 58px như mockup:
              bản chữ mới dài hơn bản cũ ("Khám phá / hệ nghề của bạn"), mà cột
              trái chỉ rộng 596 - 40 - 48 = 508px. Đo bằng chính font Be Vietnam
              Pro SemiBold (tracking -0.035em): "công nghệ của bạn" chiếm
              516.1px ở 58px -> tràn thành 3 dòng, 498.3px ở 56px, 480.5px ở
              54px -> dư 27px. Đổi chữ dài hơn nữa thì phải đo lại, đừng tăng
              cỡ theo cảm tính. whitespace-nowrap chỉ bật từ sm: dưới ngưỡng đó
              cột còn hẹp hơn chính dòng chữ, khoá lại là chữ tràn ra ngoài. */}
          {/* Dòng hai tô dải xanh->tím (.gradient-text). Chỉ tô DÒNG THỨ HAI:
              tô cả hai dòng thì hero thành một mảng màu và mất hẳn tương phản
              với nút chính ngay bên dưới, vốn cũng là dải màu đó. */}
          <h1 className=" reveal d-1 text-pretty text-4xl leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-[54px]">
            <span className="block sm:whitespace-nowrap">Khám phá dấu ấn</span>
            <span className="pb-1 gradient-text block sm:whitespace-nowrap">
              công nghệ của bạn
            </span>
          </h1>

          <p className="reveal d-2 text-lg font-medium text-ink-body sm:text-[19px]">
            Một khuôn mặt — Một hành trình khám phá — Một góc nhìn mới về tương lai.
          </p>

          <p className="reveal d-3 max-w-[470px] text-pretty text-[15.5px] font-light leading-[1.75] text-ink-faint">
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

          <div className="reveal d-4 mt-1.5 flex flex-col items-stretch gap-3.5 sm:flex-row sm:items-center">
            {/* Là client component vì nó kéo màn chuyển cảnh trước khi điều
                hướng — xem components/StartScanButton.tsx. Mũi tên trượt phải
                khi rê chuột và vệt sáng chạy ngang vẫn nằm trong đó. */}
            <StartScanButton />
            {/* ?demo=1 — KHÔNG trỏ trần vào /result. Phiên mới chưa quét gì thì
                /result chỉ hiện "Chưa có phiếu nào", tức nút này vô dụng đúng
                lúc cần nó nhất (người xem chưa quét). Tham số này bảo màn 04
                dựng phiếu từ lib/demo.ts. */}
            <Link
              href="/result?demo=1"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-btn border border-line-strong bg-card px-6 py-4 text-[15.5px] font-medium text-blue-deep transition-all duration-300 hover:-translate-y-0.5 hover:border-blue hover:shadow-[0_14px_28px_-18px_rgba(37,99,235,0.7)]"
            >
              Xem kết quả mẫu
            </Link>
          </div>

        </div>

        {/* Khung hero — ô ảnh chân dung mà mockup chừa sẵn.
            ẢNH MINH HOẠ, không phải kết quả quét của ai: lớp lưới trên mặt là
            một phần của chính tấm ảnh. Nền chuyển sắc giữ nguyên bên dưới để
            khung không trắng bệch trong lúc ảnh đang tải. */}
        <div className="fade-in relative min-h-[320px] overflow-hidden bg-[linear-gradient(150deg,#DCE6FF_0%,#C9D8FF_45%,#B7A7F5_100%)] lg:min-h-0">
          <Image
            src="/images/image.png"
            alt="Ảnh minh hoạ: khuôn mặt với lưới điểm mốc quét chồng lên"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
          {/* Vạch quét chạy dọc khung ảnh, 6 giây một lượt — gợi lại động tác
              quét của màn 02. THUẦN TRANG TRÍ: không đo gì, không phải tiến độ,
              và tấm ảnh bên dưới cũng chỉ là ảnh minh hoạ. Để chu kỳ dài và độ
              mờ thấp, vì dải này chạy vĩnh viễn suốt buổi chiếu — nhấp nháy
              nhanh là mỏi mắt cả hội trường. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-full animate-[fp-sweep_6s_ease-in-out_infinite]">
              <div className="h-[3px] w-full bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.85),rgba(124,92,255,0.85),transparent)] blur-[1px]" />
            </div>
          </div>
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
            {STEPS.map(({ no, icon, title, body, warm }, i) => (
              <Reveal
                as="li"
                key={no}
                delay={(i + 1) as 1 | 2 | 3 | 4}
                className="group flex items-start gap-3.5 lg:border-l lg:border-line-dark lg:pl-5"
              >
                <span
                  aria-hidden
                  className={
                    "inline-flex h-11 w-11 flex-none items-center justify-center rounded-btn border text-lg transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 " +
                    (warm
                      ? "border-violet-light/40 bg-violet-light/20 text-[#C4B5FD] group-hover:shadow-[0_10px_22px_-12px_rgba(124,92,255,0.9)]"
                      : "border-sky/35 bg-blue/20 text-[#93C5FD] group-hover:shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)]")
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
              </Reveal>
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
