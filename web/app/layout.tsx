import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Header from "@/components/Header";
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
    "Khoa Công nghệ thông tin & Kinh tế số, Học viện Ngân hàng. " +
    "Đối chiếu đặc điểm khuôn mặt với bộ luật tướng học cổ đã số hoá. " +
    "Kết quả chỉ để tham khảo, không dùng cho tuyển dụng hay đánh giá năng lực.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className="min-h-screen bg-page text-ink-body antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
