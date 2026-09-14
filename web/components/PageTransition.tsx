"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Hiệu ứng chuyển màn: trang mới trôi lên rồi hiện rõ (class .page-enter).
//
// CÁCH HOẠT ĐỘNG: `key={pathname}` làm React bỏ cây cũ và dựng cây mới mỗi khi
// đổi đường dẫn, nhờ đó animation chạy lại. Không có key thì React tái dùng thẻ
// div cũ, animation chỉ chạy đúng một lần lúc tải trang đầu tiên.
//
// KEY LÀ PATHNAME, KHÔNG PHẢI CẢ URL: `/result` và `/result?demo=1` dùng chung
// một key nên đổi qua lại giữa phiếu thật và phiếu mẫu không dựng lại cả trang.
// Đây là chủ ý — phiếu mẫu và phiếu thật là cùng một màn, chớp một cái ở đó
// trông như trang bị nạp lại.
//
// Không có hiệu ứng "trang cũ đi ra": muốn thế thì phải giữ cây cũ sống thêm
// vài trăm mili-giây sau khi đã điều hướng, tức là hai trang cùng tồn tại —
// riêng màn 02 thì điều đó nghĩa là camera vẫn đang chạy trong cái trang lẽ ra
// đã rời đi. Không đáng đổi một quy tắc riêng tư lấy một hiệu ứng.
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
