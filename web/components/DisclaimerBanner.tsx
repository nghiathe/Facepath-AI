// Dòng disclaimer bắt buộc ở màn 01 và 04 (CLAUDE.md mục 1 + 13).
// KHÔNG được bỏ, không được làm mờ nhạt.
//
// Câu "không dùng cho tuyển dụng, xét học bổng hay đánh giá năng lực" là ràng
// buộc bất di bất dịch của mục 1, nên được giữ nguyên khi thay bản chữ mới —
// bản chữ đó nói kết quả "không phản ánh chính xác năng lực", còn đây là cấm
// dùng vào việc gì, hai ý khác nhau.
export default function DisclaimerBanner() {
  return (
    <aside
      role="note"
      className="flex flex-col gap-1.5 rounded-card border border-line-soft bg-surface px-5 py-4 text-[12.5px] leading-relaxed text-ink-faintest"
    >
      <strong className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        Lưu ý
      </strong>
      <p>
        Nhân tướng học là một{" "}
        <strong className="font-semibold text-ink-muted">
          tri thức văn hóa dân gian
        </strong>
        , không phải phương pháp đánh giá khoa học.
      </p>
      <p>
        Kết quả được tạo ra nhằm{" "}
        <strong className="font-semibold text-ink-muted">
          mục đích trải nghiệm, tham khảo và giải trí
        </strong>
        , không phản ánh chính xác năng lực, tính cách hay khả năng thành công
        trong một nghề nghiệp —{" "}
        <strong className="font-semibold text-ink-muted">
          không dùng cho tuyển dụng, xét học bổng hay đánh giá năng lực
        </strong>
        .
      </p>
      <p>
        <strong className="font-semibold text-ink-muted">
          Các tỷ lệ phần trăm thể hiện mức độ tương đồng giữa đặc điểm được phân
          tích và nội dung trong nguồn dữ liệu
        </strong>
        , không phải xác suất hay dự báo khả năng phù hợp hoặc thành công trong
        nghề nghiệp.
      </p>
    </aside>
  );
}
