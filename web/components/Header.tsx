"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 3 mục điều hướng đúng như mockup và CLAUDE.md mục 5.
const NAV = [
  { href: "/scan", label: "Quét gương mặt" },
  { href: "/library", label: "Kho luận giải" },
  { href: "/about", label: "Về phương pháp" },
] as const;

// Mốc 1 chưa có đăng nhập; tên hiển thị cứng theo mockup.
const USER = { name: "Nguyễn An · K26", initials: "NA" };

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line-soft bg-card">
      <div className="mx-auto flex min-h-19 max-w-6xl flex-wrap items-center gap-x-7 gap-y-3 px-6 py-4 sm:px-10">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight text-navy">
            Khoa CNTT &amp; Kinh tế số
          </span>
          <span className="text-[11px] tracking-wide text-ink-faint">
            Học viện Ngân hàng
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-7 gap-y-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "border-b-2 border-amber py-1.5 text-[14.5px] font-semibold text-navy"
                    : "border-b-2 border-transparent py-1.5 text-[14.5px] text-ink-muted transition-colors hover:text-navy"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-[13.5px] text-ink-muted sm:inline">
            {USER.name}
          </span>
          <span
            aria-hidden
            className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-full bg-navy text-[12.5px] font-semibold text-white"
          >
            {USER.initials}
          </span>
        </div>
      </div>
    </header>
  );
}
