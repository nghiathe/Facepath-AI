// Dòng disclaimer bắt buộc ở màn 01 và 04 (CLAUDE.md mục 1 + 13).
// KHÔNG được bỏ, không được làm mờ nhạt.
export default function DisclaimerBanner() {
  return (
    <aside
      role="note"
      className="rounded-card border border-line-soft bg-surface px-5 py-4 text-[12.5px] leading-relaxed text-ink-faintest"
    >
      <p>
        Tướng học là tri thức văn hoá dân gian,{" "}
        <strong className="font-semibold text-ink-muted">
          không phải kết luận khoa học
        </strong>
        . Kết quả chỉ mang tính tham khảo và giải trí —{" "}
        <strong className="font-semibold text-ink-muted">
          không dùng cho tuyển dụng, xét học bổng hay đánh giá năng lực
        </strong>
        .
      </p>
      <p className="mt-1.5">
        Tỉ lệ % là <em className="not-italic font-semibold text-ink-muted">mức khớp</em>{" "}
        giữa đặc điểm đọc được và mô tả trong ngữ liệu — không phải dự báo thành công
        nghề nghiệp.
      </p>
    </aside>
  );
}
