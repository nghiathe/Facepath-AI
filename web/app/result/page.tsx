import DisclaimerBanner from "@/components/DisclaimerBanner";
import MilestonePlaceholder from "@/components/MilestonePlaceholder";

export default function ResultPage() {
  return (
    <MilestonePlaceholder
      screen="Màn 04"
      title="Phiếu kết quả"
      milestone="mốc 3 (bản template) và mốc 4 (phiếu mẫu + tải PDF)"
    >
      <p className="text-sm font-light text-ink-muted">
        Sẽ có: archetype, lớp bóc tách chồng lên ảnh đã chụp, đoạn luận giải, các thẻ
        trait kèm nguồn, bảng 6 nhóm nghề với thanh %, nút Tải PDF và Quét lại.
      </p>
      {/* Disclaimer bắt buộc ở màn 04 (mục 13) — có mặt ngay từ mốc 1. */}
      <DisclaimerBanner />
    </MilestonePlaceholder>
  );
}
