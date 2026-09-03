import MilestonePlaceholder from "@/components/MilestonePlaceholder";

export default function AnalyzePage() {
  return (
    <MilestonePlaceholder
      screen="Màn 03"
      title="Đang phân tích"
      milestone="mốc 3"
    >
      <p className="text-sm font-light text-ink-muted">
        Sẽ có: 4 bước tuần tự có trạng thái, phản ánh tiến trình gọi API thật.
      </p>
    </MilestonePlaceholder>
  );
}
