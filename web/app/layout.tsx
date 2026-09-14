import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Curtain from "@/components/Curtain";
import Header from "@/components/Header";
import PageTransition from "@/components/PageTransition";
import "./globals.css";

// Hệ chữ duy nhất của dự án (CLAUDE.md mục 5).
// subsets phải có "vietnamese", thiếu là chữ mất dấu.
// next/font tự host font, không gọi CDN lúc chạy.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["200", "300", "400", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam",
});

export const metadata: Metadata = {
  title: "Facepath-AI — Quét gương mặt, gợi ý nhóm nghề",
  description:
    "Khoa Công nghệ thông tin & Kinh tế số, Học viện Ngân hàng. "
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className="min-h-screen bg-page text-ink-body antialiased">
        {/* Header nằm NGOÀI PageTransition: nó không đổi giữa các màn, cho nó
            chớp theo mỗi lần điều hướng thì logo và nút menu nhấp nháy suốt
            buổi chiếu. Chỉ phần nội dung mới chạy hiệu ứng. */}
        <Header />
        <PageTransition>{children}</PageTransition>
        {/* Ngoài PageTransition: tấm màn phải sống sót qua chính cú điều hướng
            mà nó đang che — xem ghi chú trong components/Curtain.tsx. */}
        <Curtain />
      </body>
    </html>
  );
}
