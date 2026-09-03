import MilestonePlaceholder from "@/components/MilestonePlaceholder";

export default function AboutPage() {
  return (
    <MilestonePlaceholder
      screen="Trang phụ"
      title="Về phương pháp"
      milestone="mốc 5"
    >
      <p className="text-sm font-light text-ink-muted">
        Sẽ giải thích: cách trích đặc trưng từ 478 điểm mốc, cách chấm điểm nhóm nghề,
        danh mục cổ thư dùng làm nguồn, và giới hạn của phương pháp.
      </p>
    </MilestonePlaceholder>
  );
}
