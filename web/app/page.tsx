import Link from "next/link";
import DisclaimerBanner from "@/components/DisclaimerBanner";

// Màn 01 — Trang chủ (CLAUDE.md mục 11).
// 478 là hằng số của MediaPipe Face Landmarker nên ghi thẳng được;
// các con số tính ra (% khớp, số luật, thời gian) thì tuyệt đối không hard-code.
const POINTS = [
  {
    no: "01",
    title: "Camera trình duyệt",
    body: "Không tải ảnh lên, không lưu khung hình.",
  },
  {
    no: "02",
    title: "478 điểm mốc",
    body: "MediaPipe Face Landmarker chạy ngay tại máy.",
  },
  {
    no: "03",
    title: "Bộ luật tướng học",
    body: "Khớp đặc điểm với ngữ liệu cổ thư đã số hoá.",
  },
  {
    no: "04",
    title: "RAG + LLM",
    body: "Sinh luận giải kèm trích dẫn có thể kiểm tra.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-14 text-center sm:px-10 sm:py-20">
      <span className="label-caps text-amber-text">
        Đồ án Khoa Công nghệ thông tin &amp; Kinh tế số
      </span>

      <h1 className="text-pretty text-4xl leading-[1.14] tracking-[-0.03em] sm:text-5xl">
        Gương mặt bạn nói gì về
        <br className="hidden sm:inline" /> nhóm nghề phù hợp?
      </h1>

      <p className="max-w-xl text-pretty text-base font-light text-ink-body sm:text-[16.5px]">
        Quét bằng camera trình duyệt, đối chiếu 478 điểm mốc với bộ luật tướng học
        cổ, nhận luận giải tiếng Việt kèm nguồn dẫn và các nhóm nghề gợi ý.{" "}
        <strong className="font-semibold text-ink-muted">
          Ảnh không rời khỏi thiết bị của bạn.
        </strong>
      </p>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Link
          href="/scan"
          className="rounded-btn bg-navy px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-navy-deep"
        >
          Bắt đầu quét
        </Link>
        <Link
          href="/result"
          className="rounded-btn border border-line-strong px-7 py-4 text-[15.5px] font-medium text-navy transition-colors hover:border-navy"
        >
          Xem một phiếu mẫu
        </Link>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 border-t border-line-soft pt-8 text-left sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map(({ no, title, body }) => (
          <div key={no} className="flex flex-col gap-2">
            <span className="text-[13px] font-bold tracking-wider text-amber-text">
              {no}
            </span>
            <strong className="text-[15px] font-semibold text-ink-title">
              {title}
            </strong>
            <span className="text-[13.5px] font-light leading-relaxed text-ink-muted">
              {body}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full text-left">
        <DisclaimerBanner />
      </div>
    </main>
  );
}
