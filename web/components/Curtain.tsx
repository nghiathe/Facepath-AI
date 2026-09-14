"use client";

import { useEffect, useRef, useState } from "react";
import {
  CURTAIN_COVER_MS,
  CURTAIN_EVENT,
  CURTAIN_REVEAL_MS,
} from "@/lib/curtain";

// Tấm màn phủ toàn màn hình cho cú chuyển trang chủ → màn Quét.
//
// PHẢI ĐẶT Ở LAYOUT, KHÔNG ĐẶT TRONG TRANG. Nó cần sống sót qua chính cú điều
// hướng mà nó đang che: đặt trong trang chủ thì lúc React tháo trang chủ ra,
// tấm màn biến mất ngay giữa chừng và người xem thấy một cú cắt phựt.
//
// Cũng vì vậy nó nằm NGOÀI PageTransition — trong đó thì mỗi lần đổi đường dẫn
// là bị dựng lại, đúng thời điểm không được phép dựng lại.
//
// Chuyển động là MỘT mạch liên tục đi lên: trượt từ dưới lên che kín (cover),
// rồi trượt tiếp lên trên để lộ trang mới (reveal). Không có quãng đứng yên —
// đứng yên giữa hai pha là cảm giác giật, không phải mượt.
type Phase = "idle" | "cover" | "reveal";

export default function Curtain() {
  const [phase, setPhase] = useState<Phase>("idle");
  // Đọc phase trong listener thì dính giá trị cũ của closure; dùng ref để chặn
  // bấm dồn (bấm lần hai giữa lúc màn kéo đang chạy sẽ làm hẹn giờ chồng nhau).
  const busy = useRef(false);

  useEffect(() => {
    let toReveal: number | undefined;
    let toIdle: number | undefined;

    const onRun = () => {
      if (busy.current) return;
      busy.current = true;
      setPhase("cover");
      toReveal = window.setTimeout(() => setPhase("reveal"), CURTAIN_COVER_MS);
      toIdle = window.setTimeout(() => {
        setPhase("idle");
        busy.current = false;
      }, CURTAIN_COVER_MS + CURTAIN_REVEAL_MS);
    };

    window.addEventListener(CURTAIN_EVENT, onRun);
    return () => {
      window.removeEventListener(CURTAIN_EVENT, onRun);
      clearTimeout(toReveal);
      clearTimeout(toIdle);
    };
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      // Thuần trang trí: trình đọc màn hình không cần biết có tấm màn nào.
      // pointer-events-none để cú bấm tiếp theo không bị nuốt nếu có gì trục
      // trặc và tấm màn kẹt lại trên màn hình.
      aria-hidden
      className={
        "pointer-events-none fixed inset-0 z-50 " +
        (phase === "cover" ? "curtain-cover" : "curtain-reveal")
      }
    >
      <div className="h-full w-full bg-[linear-gradient(135deg,#1D4ED8_0%,#2563EB_45%,#6D4DF6_100%)]">
        {/* Vạch sáng ở mép trên — biến tấm màn thành một đầu quét chạy qua màn
            hình, thay vì một mảng màu trơn trượt lên. */}
        <div className="h-[3px] w-full bg-[linear-gradient(90deg,transparent,#38BDF8,#EAF0FF,#38BDF8,transparent)]" />
      </div>
    </div>
  );
}
