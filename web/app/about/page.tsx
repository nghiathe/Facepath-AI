import Link from "next/link";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { CAREERS, FACE_TYPES, RULES, SOURCES } from "@/lib/data";
import { FEATURE_KEYS, FEATURE_LAYERS } from "@/lib/features/catalog";
import { TOTAL_LANDMARKS } from "@/lib/features/landmark-ids";

// Trang "Về Tech Camp" — giới thiệu bối cảnh và giải thích phương pháp.
//
// Mọi con số ở đây đều đếm từ dữ liệu thật lúc build (CLAUDE.md mục 13: không
// hard-code số hiển thị). Thêm một luật vào data/rules.json thì trang này tự
// đổi theo, không phải sửa tay.

const TRAIT_COUNT = new Set(RULES.map((r) => r.trait)).size;
const CITED_SOURCE_COUNT = new Set(RULES.map((r) => r.source)).size;

const PIPELINE = [
  {
    no: "01",
    title: `Đọc ${TOTAL_LANDMARKS} điểm mốc`,
    body:
      "MediaPipe Face Landmarker chạy bằng WASM ngay trong trình duyệt, trên " +
      "khung hình camera hoặc ảnh bạn chọn từ máy.",
  },
  {
    no: "02",
    title: `Bóc tách ${FEATURE_LAYERS.length} lớp · ${FEATURE_KEYS.length} chỉ số`,
    body:
      "Toạ độ điểm mốc được quy về các tỉ lệ đã chuẩn hoá (chia cho khoảng cách " +
      "hai mắt) nên không phụ thuộc bạn ngồi gần hay xa máy.",
  },
  {
    no: "03",
    title: `Khớp ${RULES.length} luật tướng học`,
    body:
      "Mỗi luật là một điều kiện trên một chỉ số, suy ra một nét tính cách, kèm " +
      "tên sách và vị trí trích dẫn. Việc khớp luật là phép so sánh ngưỡng — " +
      "cùng một khuôn mặt luôn cho cùng một kết quả.",
  },
  {
    no: "04",
    title: `Chấm điểm ${CAREERS.length} nhóm nghề`,
    body:
      "Điểm mỗi nhóm = phần tín hiệu đã khớp chia cho toàn bộ tín hiệu mà bộ " +
      "luật có thể cộng cho nhóm đó. Vì vậy % đọc là “mức khớp đặc điểm”, không " +
      "phải xác suất thành công.",
  },
  {
    no: "05",
    title: "Ghép đoạn luận giải",
    body:
      "Đoạn văn trên phiếu được nối lại từ chính mô tả của các luật đã khớp. " +
      "Chưa có mô hình ngôn ngữ nào tham gia, nên không có câu nào nằm ngoài " +
      "nguồn dẫn.",
  },
] as const;

const LIMITS = [
  {
    title: "Đây là tri thức văn hoá, không phải khoa học",
    body:
      "Tướng học cổ mô tả mối liên hệ giữa diện mạo và tính cách theo quan niệm " +
      "dân gian. Không có bằng chứng khoa học nào cho thấy khuôn mặt quyết định " +
      "năng lực hay nghề nghiệp.",
  },
  {
    title: "Trọng số nghề là lớp diễn giải của nhóm dự án",
    body:
      "Cổ thư nói về tính cách và cách hành xử, hầu như không nói tới nghề " +
      "nghiệp hiện đại. Việc quy các nét tính cách về sáu nhóm nghề là do nhóm " +
      "dự án đặt ra — phần này không có trong sách.",
  },
  {
    title: "Vài chỉ số chỉ là xấp xỉ",
    body:
      "Dạng trán được suy từ đường bao trán vì lưới điểm mốc không thấy chân " +
      "tóc. Các luật về tai bị để riêng ngoài bộ luật đang chạy: lưới điểm mốc " +
      "không có điểm nào ở tai.",
  },
  {
    title: "Ánh sáng và góc mặt ảnh hưởng tới số đo",
    body:
      "Nghiêng đầu, thiếu sáng hoặc tóc che cung mày đều làm các tỉ lệ lệch đi. " +
      "Màn quét chỉ cho chụp khi điều kiện đủ tốt, nhưng sai số vẫn còn.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12 sm:px-10 sm:py-16">
      <section className="flex flex-col gap-3">
        <span className="label-caps">Về Tech Camp</span>
        <h1 className="text-3xl sm:text-4xl">Gương mặt công nghệ</h1>
        <p className="max-w-[700px] text-[15.5px] font-light leading-[1.75] text-ink-faint">
          Sản phẩm của <strong className="font-semibold text-ink-body">ITDE Tech Camp 2027</strong>{" "}
          — Khoa Công nghệ thông tin &amp; Kinh tế số, Học viện Ngân hàng. Ứng
          dụng đối chiếu đặc điểm gương mặt bạn với một bộ luật tướng học cổ đã
          số hoá, rồi lập một phiếu luận giải có trích dẫn nguồn. Mục đích là để
          bạn thấy một chuỗi xử lý dữ liệu chạy thật: từ điểm mốc trên ảnh, qua
          bộ luật, tới một bảng số — chứ không phải để nói bạn hợp nghề gì.
        </p>
      </section>

      {/* Riêng tư đặt lên trước phương pháp: đây là cam kết, không phải tính năng phụ. */}
      <section className="flex flex-col gap-3 rounded-panel border border-line-soft bg-card px-6 py-6">
        <h2 className="text-xl">Ảnh của bạn không rời khỏi máy</h2>
        <ul className="flex flex-col gap-2.5 text-[14.5px] font-light leading-relaxed text-ink-body">
          <li>
            Camera, lưới điểm mốc và toàn bộ phép tính đều chạy trong trình duyệt.
            Không khung hình nào được gửi lên máy chủ, kể cả khi bạn tải ảnh từ máy.
          </li>
          <li>
            Việc chấm điểm cũng chạy tại chỗ: một lượt quét không phát sinh
            request nào, nên tắt mạng vẫn dùng được.
          </li>
          <li>
            Ảnh đã chụp chỉ nằm trong tab đang mở và mất khi bạn đóng tab.{" "}
            <Link href="/history" className="text-blue-deep underline underline-offset-2">
              Lịch sử quét
            </Link>{" "}
            lưu trên máy bạn và cố ý không giữ ảnh — chỉ giữ các chỉ số.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Ứng dụng làm gì với gương mặt</h2>
        <ol className="flex flex-col gap-3">
          {PIPELINE.map((s) => (
            <li
              key={s.no}
              className="flex gap-4 rounded-card border border-line-soft bg-card px-5 py-4"
            >
              <span className="text-sm font-bold tracking-[0.1em] text-sky">{s.no}</span>
              <div className="flex flex-col gap-1">
                <strong className="text-[15.5px] font-semibold text-ink-title">
                  {s.title}
                </strong>
                <span className="text-[13.5px] font-light leading-relaxed text-ink-muted">
                  {s.body}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-ink-faintest">
          Tất cả nằm trong{" "}
          <Link href="/library" className="text-blue-deep underline underline-offset-2">
            Kho luận giải
          </Link>
          : {RULES.length} luật · {TRAIT_COUNT} nét tính cách · {FACE_TYPES.length}{" "}
          kiểu tướng ngũ hình · {CITED_SOURCE_COUNT}/{SOURCES.length} nguồn đang
          được dẫn.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Phương pháp này có giới hạn gì</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LIMITS.map((l) => (
            <article
              key={l.title}
              className="flex flex-col gap-1.5 rounded-card border border-line-soft bg-surface px-5 py-4"
            >
              <strong className="text-[14.5px] font-semibold text-ink-title">
                {l.title}
              </strong>
              <span className="text-[13.5px] font-light leading-relaxed text-ink-body">
                {l.body}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Ngữ liệu</h2>
        <p className="max-w-[700px] text-[14.5px] font-light leading-relaxed text-ink-muted">
          Ngữ liệu gốc là cuốn <em>Nhân Tướng Học</em> (Hy Trương) đã số hoá; các
          cổ thư khác đều được trích lại trong sách này. Mỗi luật ghi rõ quyển và
          mục để bạn tra ngược lại.
        </p>
        <ul className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <li
              key={s.id}
              className="rounded-[8px] border border-line-soft bg-card px-3 py-1.5 text-[12.5px] text-ink-body"
            >
              {s.title}
            </li>
          ))}
        </ul>
      </section>

      <DisclaimerBanner />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/scan"
          className="btn-primary inline-flex items-center justify-center gap-2.5 rounded-btn px-7 py-3.5 text-[15px] font-semibold"
        >
          Quét thử <span aria-hidden>→</span>
        </Link>
        <Link
          href="/library"
          className="inline-flex items-center justify-center rounded-btn border border-line-strong bg-card px-6 py-3.5 text-[15px] font-medium text-blue-deep transition-colors hover:border-blue"
        >
          Xem bộ luật
        </Link>
      </div>
    </main>
  );
}
