import MilestonePlaceholder from "@/components/MilestonePlaceholder";

export default function ScanPage() {
  return (
    <MilestonePlaceholder
      screen="Màn 02"
      title="Quét gương mặt"
      milestone="mốc 2"
    >
      <p className="text-sm font-light text-ink-muted">
        Sẽ có: bật camera, khung căn mặt, panel &ldquo;Đặc trưng đang đọc&rdquo; cập
        nhật live 4 chỉ số, chỉ báo điều kiện chụp, và nút Chụp và phân tích.{" "}
        <strong className="font-semibold text-ink-title">
          Ảnh xử lý hoàn toàn tại máy — chỉ vector số được gửi đi.
        </strong>
      </p>
    </MilestonePlaceholder>
  );
}
