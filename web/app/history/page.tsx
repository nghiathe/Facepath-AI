"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clearHistory,
  MAX_ENTRIES,
  removeHistory,
  useHistory,
  type HistoryEntry,
} from "@/lib/history";
import { saveScan } from "@/lib/session";

// Trang "Lịch sử quét" — thay cho "Bảng xếp hạng" và "Thành tựu" của mockup.
//
// VÌ SAO KHÔNG LÀM BẢNG XẾP HẠNG: xếp hạng người dùng theo kết quả quét gương
// mặt biến một thứ giải trí thành thước đo so sánh giữa người với người, đúng
// điều CLAUDE.md mục 1 cấm ("không dùng cho tuyển dụng, xét học bổng hay đánh
// giá năng lực"). Lịch sử cá nhân thì không có vấn đề đó: không so ai với ai,
// và nằm trên máy của chính người quét.

const formatTime = (at: number) =>
  new Date(at).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function HistoryPage() {
  const router = useRouter();
  const entries = useHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  // Mở lại phiếu cũ: nạp lại vector số vào phiên hiện tại rồi sang màn 04.
  // Giữ nguyên `at` để không tạo thêm một mục lịch sử trùng lượt quét này.
  const reopen = (e: HistoryEntry) => {
    saveScan({
      features: e.features,
      snapshot: null, // lịch sử không lưu ảnh — xem ghi chú ở lib/history.ts
      landmarks: e.landmarks,
      at: e.at,
    });
    router.push("/result");
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 sm:px-10 sm:py-16">
      <div className="flex flex-col gap-2">
        <span className="label-caps">Lịch sử quét</span>
        <h1 className="text-3xl sm:text-4xl">Các lượt quét trên máy này</h1>
        <p className="max-w-[640px] text-[15px] font-light leading-[1.75] text-ink-faint">
          Danh sách này nằm trong trình duyệt của bạn, không có bản sao nào trên
          máy chủ. Mỗi lượt chỉ lưu{" "}
          <strong className="font-semibold text-ink-body">các chỉ số đo được</strong>{" "}
          và toạ độ điểm mốc —{" "}
          <strong className="font-semibold text-ink-body">không lưu ảnh</strong>, nên
          mở lại phiếu sẽ thấy lớp bóc tách chứ không thấy gương mặt.
        </p>
      </div>

      {entries === undefined && (
        <p className="text-sm text-ink-faintest">Đang đọc lịch sử…</p>
      )}

      {entries?.length === 0 && (
        <div className="flex flex-col items-start gap-4 rounded-card border border-line-soft bg-card px-6 py-8">
          <div className="flex flex-col gap-1.5">
            <strong className="text-lg font-semibold text-ink-title">
              Chưa có lượt quét nào
            </strong>
            <p className="text-sm font-light text-ink-muted">
              Quét gương mặt một lần, phiếu sẽ tự vào đây để bạn mở lại sau.
            </p>
          </div>
          <Link
            href="/scan"
            className="btn-primary inline-flex items-center gap-2 rounded-btn px-6 py-3 text-sm font-semibold"
          >
            Bắt đầu quét <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {entries && entries.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-4 rounded-card border border-line-soft bg-card px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs text-ink-faintest">
                    {formatTime(e.at)} · {e.matchedRulesCount}/{e.totalRulesCount}{" "}
                    luật khớp · {e.sourcesCount} nguồn dẫn
                  </span>
                  <strong className="text-[17px] font-semibold text-ink-title">
                    {e.archetype}
                  </strong>
                  {e.traits.length > 0 && (
                    <span className="truncate text-[13px] font-light text-ink-muted">
                      {e.traits.join(" · ")}
                    </span>
                  )}
                </div>

                {e.lead && (
                  <div className="flex w-full flex-col gap-1 sm:w-52">
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="truncate text-ink-body">{e.lead.name}</span>
                      <span className="shrink-0 font-semibold text-blue-deep">
                        {e.lead.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(135deg,#2563EB,#6D4DF6)]"
                        style={{ width: `${e.lead.percent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-ink-faintest">
                      mức khớp đặc điểm, không phải dự báo nghề
                    </span>
                  </div>
                )}

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => reopen(e)}
                    className="rounded-btn border border-line-strong px-4 py-2.5 text-[13px] font-medium text-blue-deep transition-colors hover:border-blue"
                  >
                    Mở lại phiếu
                  </button>
                  <button
                    type="button"
                    onClick={() => removeHistory(e.id)}
                    aria-label={`Xoá lượt quét ${formatTime(e.at)}`}
                    className="rounded-btn border border-line-soft px-3 py-2.5 text-[13px] text-ink-faintest transition-colors hover:border-line-strong hover:text-ink-body"
                  >
                    Xoá
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
            <span className="text-xs text-ink-faintest">
              Giữ tối đa {MAX_ENTRIES} lượt gần nhất; lượt cũ hơn tự rơi ra.
            </span>
            <span className="flex-1" />
            {confirmClear ? (
              <>
                <span className="text-[13px] text-ink-body">
                  Xoá toàn bộ {entries.length} lượt?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    setConfirmClear(false);
                  }}
                  className="rounded-btn bg-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-deep"
                >
                  Xoá hết
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-btn border border-line-soft px-4 py-2.5 text-[13px] text-ink-faint"
                >
                  Thôi
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="rounded-btn border border-line-strong px-4 py-2.5 text-[13px] text-ink-body transition-colors hover:border-blue hover:text-blue-deep"
              >
                Xoá toàn bộ lịch sử
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
