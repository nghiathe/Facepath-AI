import MilestonePlaceholder from "@/components/MilestonePlaceholder";

// Trang "Lịch sử quét" — thay cho "Bảng xếp hạng" và "Thành tựu" của mockup.
//
// VÌ SAO KHÔNG LÀM BẢNG XẾP HẠNG: xếp hạng người dùng theo kết quả quét gương
// mặt biến một thứ giải trí thành thước đo so sánh giữa người với người, đúng
// điều CLAUDE.md mục 1 cấm ("không dùng cho tuyển dụng, xét học bổng hay đánh
// giá năng lực"). Lịch sử cá nhân thì không có vấn đề đó.
//
// Khi dựng thật: lưu ở máy người dùng, và cân nhắc kỹ có nên giữ `snapshot`
// (ảnh dạng data URL) hay chỉ giữ vector số — ảnh không rời thiết bị, nhưng
// lưu lâu dài trên máy dùng chung vẫn là chuyện cần người dùng chủ động chọn.
export default function HistoryPage() {
  return (
    <MilestonePlaceholder
      screen="Trang phụ"
      title="Lịch sử quét"
      milestone="mốc sau"
    >
      <p className="text-sm font-light leading-relaxed text-ink-faint">
        Sẽ liệt kê các lượt quét trong máy bạn: kiểu tướng, nhóm nghề dẫn đầu và
        thời điểm quét — mở lại được phiếu cũ mà không cần quét lại.
      </p>
    </MilestonePlaceholder>
  );
}
