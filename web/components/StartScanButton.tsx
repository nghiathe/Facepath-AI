"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { runCurtain } from "@/lib/curtain";

// Nút "Trải nghiệm ngay" ở trang chủ, kèm màn kéo chuyển cảnh (lib/curtain.ts).
//
// VẪN LÀ MỘT THẺ <Link>, không đổi thành <button>. Giữ nguyên như vậy để:
//   - Next tiếp tục prefetch chunk của /scan khi nút lọt vào tầm nhìn — chính
//     thứ khiến cú chuyển chỉ mất 83ms;
//   - bấm giữa chuột / Ctrl+bấm vẫn mở được tab mới, chuột phải vẫn có "Mở
//     liên kết trong tab mới", và trình đọc màn hình vẫn đọc ra là một liên kết
//     có đích rõ ràng.
// Đổi sang <button onClick={router.push}> là mất sạch những thứ đó.
export default function StartScanButton() {
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Chỉ can thiệp vào cú bấm trái đơn thuần. Mọi tổ hợp còn lại (Ctrl/Cmd để
    // mở tab mới, Shift mở cửa sổ mới, bấm giữa) phải để trình duyệt tự xử —
    // chặn chúng rồi router.push sẽ nuốt mất thao tác người dùng cố ý làm.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    runCurtain(() => router.push("/scan"));
  };

  return (
    <Link
      href="/scan"
      onClick={onClick}
      className="btn-primary group inline-flex items-center justify-center gap-2.5 rounded-btn px-7 py-4 text-base font-semibold"
    >
      Trải nghiệm ngay{" "}
      <span
        aria-hidden
        className="text-[17px] transition-transform duration-300 group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}
