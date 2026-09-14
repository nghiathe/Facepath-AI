"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Menu theo design/itde-tech-camp.html màn 01.
// Mockup có "Bảng xếp hạng" và "Thành tựu"; cả hai gộp thành "Lịch sử quét" —
// xếp hạng người dùng theo kết quả quét mặt đi ngược nguyên tắc ở CLAUDE.md
// mục 1 ("không dùng cho ... đánh giá năng lực"), còn lịch sử thì khớp sẵn với
// bảng `sessions` đã dự trù ở mục 6.
const NAV = [
  { href: "/", label: "Trang chủ" },
  { href: "/scan", label: "Quét gương mặt" },
  { href: "/library", label: "Khám phá" },
  { href: "/history", label: "Lịch sử quét" },
  { href: "/about", label: "Về Tech Camp" },
] as const;

const MENU_ID = "menu-chinh";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Đổi trang thì đóng menu, nếu không nó vẫn mở chồng lên trang mới.
  // Chỉnh state ngay trong lúc render (pattern "adjusting state on prop change"
  // của React) chứ KHÔNG dùng useEffect: setState đồng bộ trong effect gây
  // cascading render và React 19 báo lỗi thẳng — xem ghi chú ở lib/session.ts.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Esc để đóng — menu là lớp phủ nên phải có đường thoát bằng bàn phím.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="relative z-20 border-b border-line-soft bg-card">
      {/* Grid 3 cột thay vì flex: cột giữa mới canh logo vào đúng tâm trang.
          Cột phải là ô trống rộng bằng nút bên trái — bỏ nó đi thì logo lệch
          sang phải đúng bằng bề ngang cái nút.
          Không đặt max-width, và lề ngang lấy ĐÚNG lề nội dung của trang
          (px-6 / sm:px-10 — xem app/page.tsx): mép trái nút menu thẳng hàng với
          nhãn "ITDE Tech Camp 2026" và tiêu đề "Cách thức trải nghiệm" bên
          dưới. Hai ô 48px hai bên cân nhau nên logo vẫn đúng tâm trang. */}
      <div className="grid h-20 w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-6 sm:h-26 sm:px-10">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label={open ? "Đóng menu" : "Mở menu"}
          className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-btn border border-line-strong bg-card transition-colors hover:border-blue hover:bg-blue/5 sm:h-12 sm:w-12"
        >
          {/* Ba vạch gập lại thành dấu X khi menu mở: vạch trên và vạch dưới
              xoay chéo, vạch giữa mờ đi. Chỉ animate transform/opacity nên
              không đụng tới layout của header. */}
          <span
            className={
              "block h-0.5 w-5 rounded-sm bg-blue-deep transition-transform duration-300 " +
              (open ? "translate-y-[7px] rotate-45" : "")
            }
          />
          <span
            className={
              "block h-0.5 w-5 rounded-sm bg-blue-deep transition-opacity duration-200 " +
              (open ? "opacity-0" : "opacity-100")
            }
          />
          {/* Vạch thứ ba ngắn hơn — chi tiết của mockup, không phải lỗi. Lúc
              gập thành X thì phải dài bằng vạch trên, nếu không dấu X lệch. */}
          <span
            className={
              "block h-0.5 rounded-sm bg-blue-deep transition-all duration-300 " +
              (open ? "w-5 -translate-y-[7px] -rotate-45" : "w-3.5")
            }
          />
        </button>

        {/* Logo khoa đã có sẵn chữ trong ảnh nên không lặp lại bằng text;
            alt giữ nguyên nội dung đó cho trình đọc màn hình. */}
        <Link href="/" className="justify-self-center">
          <Image
            src="/logo/itde_new.png"
            alt="Khoa Công nghệ thông tin & Kinh tế số — Học viện Ngân hàng"
            width={652}
            height={118}
            priority
            className="h-8 w-auto sm:h-[68px]"
          />
        </Link>

        <span aria-hidden className="h-11 w-11 sm:h-12 sm:w-12" />
      </div>

      {/* Lớp trong suốt phủ toàn trang: bấm ra ngoài là đóng menu. Không tô màu
          gì — menu này nhỏ, làm tối cả trang chỉ để mở một menu 5 mục thì nặng
          nề, nhất là khi đang chiếu. */}
      {open && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 -z-10 cursor-default"
        />
      )}

      {open && (
        <nav
          id={MENU_ID}
          aria-label="Điều hướng chính"
          className="scale-in absolute left-6 top-full mt-2 w-[300px] max-w-[calc(100vw-3rem)] origin-top-left rounded-card border border-line-soft bg-card p-2.5 shadow-menu sm:left-10"
        >
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ href, label }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    // Bấm đúng mục đang mở thì pathname không đổi, nên phần
                    // đóng-menu-khi-đổi-trang ở trên không chạy. Đóng tay ở đây.
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={
                      "block rounded-[11px] px-4 py-3 text-[15px] transition-colors " +
                      (active
                        ? "bg-blue/7 font-semibold text-blue-deep"
                        : "text-ink-body hover:bg-blue/6")
                    }
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
