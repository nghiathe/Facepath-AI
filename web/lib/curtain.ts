"use client";

// Màn kéo chuyển cảnh cho cú bấm "Trải nghiệm ngay" (trang chủ → màn Quét).
//
// VÌ SAO CẦN RIÊNG MỘT THỨ NẶNG HƠN .page-enter: hiệu ứng chuyển màn chung chỉ
// là mờ dần + trôi lên 12px. Từ trang chủ sang màn Quét thì hai màn cùng nền
// sáng và header giống hệt nhau, nên mắt gần như không bắt được là đã đổi màn.
// Đây lại đúng là cú bấm mở đầu trải nghiệm, đáng có một nhịp rõ ràng.
//
// KHÔNG PHẢI ĐỂ CHE ĐỘ TRỄ. Đã đo trên bản production: từ lúc bấm tới lúc màn
// Quét hiện ra chỉ 83ms (77ms cả khi giả lập mạng chậm), vì Next prefetch sẵn
// chunk của /scan khi link nằm trong tầm nhìn. Nếu sau này màn Quét nặng lên và
// bắt đầu khựng thật, đừng kéo dài màn kéo cho khỏi thấy — sửa chỗ nặng.

/** Thời gian màn kéo trượt lên che kín. Điều hướng xảy ra đúng lúc này. */
export const CURTAIN_COVER_MS = 380;

/** Thời gian màn kéo trượt tiếp để lộ ra trang mới. */
export const CURTAIN_REVEAL_MS = 440;

export const CURTAIN_EVENT = "fp:curtain";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Chạy màn kéo rồi điều hướng khi nó đã che kín.
 *
 * `go` được gọi ở mốc CURTAIN_COVER_MS — lúc màn kéo phủ kín khung nhìn — nên
 * người xem không thấy trang cũ biến mất. Ai bật "giảm chuyển động" thì đi
 * thẳng, không có màn kéo nào cả.
 */
export function runCurtain(go: () => void): void {
  if (prefersReducedMotion()) {
    go();
    return;
  }
  window.dispatchEvent(new CustomEvent(CURTAIN_EVENT));
  window.setTimeout(go, CURTAIN_COVER_MS);
}
