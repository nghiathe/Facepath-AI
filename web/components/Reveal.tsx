"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

// Hiện dần khi cuộn tới — dùng cho các khối NẰM DƯỚI màn hình đầu tiên.
//
// Khối ở ngay đầu trang thì không cần component này: gắn thẳng class
// `reveal d-1`… (app/globals.css) là chạy ngay lúc tải, đỡ một lần mount client.
//
// KHÔNG BAO GIỜ ẨN NỘI DUNG BẰNG HTML TĨNH. Trạng thái render đầu tiên — tức
// cũng là HTML mà máy chủ trả về — là HIỆN BÌNH THƯỜNG. Chỉ khi JS đã chạy
// thật thì mới chuyển sang "hidden" rồi mới animate vào. Nếu làm ngược lại
// (đặt sẵn opacity-0 trong HTML) thì máy chiếu hội trại gặp lỗi JS là mất
// nguyên khối nội dung, không ai biết vì sao.
//
// Dùng useLayoutEffect chứ không useEffect: nó chạy TRƯỚC lượt vẽ đầu tiên của
// trình duyệt, nên người xem không thấy khối loé lên rồi mới mờ đi.

type Props = {
  children: ReactNode;
  /** Bậc trễ 1..6, khớp với .d-1…-d-6 trong globals.css. */
  delay?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Thẻ bọc, mặc định div. Truyền "li"/"section" để không phá cấu trúc HTML. */
  as?: ElementType;
  className?: string;
};

type Phase = "ssr" | "hidden" | "shown";

export default function Reveal({ children, delay, as, className = "" }: Props) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>("ssr");

  useLayoutEffect(() => {
    const el = ref.current;
    // Trình duyệt không có IntersectionObserver: bỏ hiệu ứng, để nội dung hiện.
    if (!el || typeof IntersectionObserver === "undefined") return;

    setPhase("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPhase("shown");
        // Chỉ chạy MỘT LẦN: khối đã hiện rồi mà cuộn qua cuộn lại cứ mờ đi
        // hiện lại thì nhìn như trang bị lỗi.
        io.disconnect();
      },
      // rootMargin âm ở đáy: đợi khối vào hẳn trong màn rồi mới chạy, thay vì
      // chạy lúc mới ló 1px và người xem lỡ mất hiệu ứng.
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const motion =
    phase === "shown"
      ? `reveal${delay ? ` d-${delay}` : ""}`
      : phase === "hidden"
        ? // print:opacity-100 là bắt buộc: khối chưa cuộn tới đang ở opacity 0,
          // mà lệnh in thì chụp cả trang chứ không chỉ phần đang nhìn thấy —
          // thiếu nó là bản PDF có những mảng trắng không hiểu vì sao.
          "opacity-0 print:opacity-100"
        : "";

  return (
    <Tag ref={ref} className={`${motion} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
