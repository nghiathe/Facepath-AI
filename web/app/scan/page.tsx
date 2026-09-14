"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPORTED_KEYS } from "@/lib/engine/accessors";
import { extractFeatures, QUALITY_LIMITS } from "@/lib/features/features";
import {
  detectFromImage,
  detectFromVideo,
  getLandmarker,
  loadImageFile,
  measureBrightness,
} from "@/lib/features/landmarks";
import { TOTAL_LANDMARKS } from "@/lib/features/landmark-ids";
import { coverBox, drawLiveMesh } from "@/lib/features/overlay";
import type { FaceFeatures, Landmark } from "@/lib/features/types";
import { saveScan } from "@/lib/session";

type Status = "idle" | "loading" | "ready" | "error";

// 4 chỉ số đại diện hiện live (CLAUDE.md mục 7).
const LIVE = [
  { label: "Tỉ lệ dáng mặt", get: (f: FaceFeatures) => f.santing.balance },
  { label: "Độ cong cung mày", get: (f: FaceFeatures) => f.eyebrows.curvature },
  { label: "Bề rộng cánh mũi", get: (f: FaceFeatures) => f.nose.wingWidth },
  { label: "Khoé miệng ngang", get: (f: FaceFeatures) => f.mouth.width },
] as const;

/**
 * Phải giữ yên đủ lâu rồi mới tự chụp.
 *
 * Con số này đi kèm câu hướng dẫn hiện trên màn và vòng đếm ngược ở góc khung
 * camera — đổi ở đây thì phải sửa cả hai chỗ chữ bên dưới cho khớp, nếu không
 * màn hình nói một đằng còn đồng hồ chạy một nẻo.
 */
const HOLD_MS = 3000;

/**
 * Nhịp cập nhật phần SỐ trên panel, tính bằng ms.
 *
 * Vòng lặp nhận diện chạy theo requestAnimationFrame (~30–60 lần/giây), nhưng
 * gọi setState từng ấy lần chỉ để đổi mấy con số là ép React dựng lại cả cây
 * component 60 lần/giây — trên laptop đang cắm máy chiếu là thấy khựng ngay.
 * Lưới điểm mốc vẫn vẽ ở tốc độ đầy đủ vì nó đi thẳng ra canvas, không qua
 * React. 8 lần/giây đã quá đủ cho một con số mà mắt người đọc kịp.
 */
const READOUT_MS = 125;

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meshRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const lastRef = useRef({ t: 0, frames: 0, fps: 0 });
  const readoutRef = useRef(0);
  const latestRef = useRef<{ features: FaceFeatures; landmarks: Landmark[] } | null>(null);

  // Mốc thời gian khuôn mặt BẮT ĐẦU đạt đủ điều kiện; 0 = đang chưa đạt.
  const holdRef = useRef(0);
  // Chặn tự chụp hai lần: vòng lặp chạy async nên khung kế tiếp vẫn kịp lọt vào
  // trước khi state `busy` của React cập nhật xong.
  const firedRef = useRef(false);
  const autoRef = useRef(true);
  // Vòng lặp cần gọi capture(), nhưng capture() được tạo lại mỗi lần render;
  // giữ bản mới nhất trong ref để loop() không phải nhận nó làm dependency.
  const captureRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FaceFeatures | null>(null);
  const [fps, setFps] = useState(0);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => stop, [stop]);

  /** Vẽ vòng đếm giữ yên thẳng vào DOM, không qua state — xem ghi chú READOUT_MS. */
  const paintHold = useCallback((progress: number) => {
    const ring = ringRef.current;
    if (ring) {
      const len = Number(ring.dataset.len ?? 0);
      ring.style.strokeDashoffset = String(len * (1 - progress));
    }
    const label = countRef.current;
    if (label) {
      const left = Math.ceil(((1 - progress) * HOLD_MS) / 1000);
      label.textContent = progress > 0 && left > 0 ? String(left) : "";
    }
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const tick = async () => {
      if (!runningRef.current || !video || !canvas) return;
      if (video.readyState >= 2) {
        const now = performance.now();
        try {
          const lm = await detectFromVideo(video, now);
          if (lm) {
            const brightness = measureBrightness(video, canvas);
            const f = extractFeatures(lm, { brightness });
            latestRef.current = { features: f, landmarks: lm };

            // Con số trên panel: hạ nhịp xuống READOUT_MS.
            if (now - readoutRef.current >= READOUT_MS) {
              readoutRef.current = now;
              setFeatures(f);
            }

            // Lưới điểm mốc: vẽ mỗi khung, đi thẳng ra canvas.
            const mesh = meshRef.current;
            const ctx = mesh?.getContext("2d");
            if (mesh && ctx) {
              const w = mesh.clientWidth;
              const h = mesh.clientHeight;
              if (mesh.width !== w || mesh.height !== h) {
                mesh.width = w;
                mesh.height = h;
              }
              drawLiveMesh(
                ctx,
                lm,
                coverBox(video.videoWidth, video.videoHeight, w, h),
                f.quality.ok
              );
            }

            // Đồng hồ giữ yên. Mặt rời khỏi điều kiện đủ là đồng hồ về 0 — đúng
            // nghĩa "giữ yên", không cộng dồn các quãng rời rạc lại với nhau.
            if (f.quality.ok) {
              if (!holdRef.current) holdRef.current = now;
              const held = now - holdRef.current;
              paintHold(Math.min(held / HOLD_MS, 1));
              if (held >= HOLD_MS && autoRef.current && !firedRef.current) {
                firedRef.current = true;
                captureRef.current();
                return; // dừng vòng lặp: capture() đã chuyển sang màn 03
              }
            } else {
              holdRef.current = 0;
              paintHold(0);
            }
          } else {
            latestRef.current = null;
            holdRef.current = 0;
            paintHold(0);
            setFeatures(null);
            const ctx = meshRef.current?.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          }
        } catch {
          /* bỏ qua khung lỗi lẻ, khung sau thử lại */
        }

        const s = lastRef.current;
        s.frames++;
        if (now - s.t >= 1000) {
          s.fps = Math.round((s.frames * 1000) / (now - s.t));
          s.frames = 0;
          s.t = now;
          setFps(s.fps);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [paintHold]);

  const start = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      await getLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 960, height: 720, facingMode: "user" },
        audio: false,
      });
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      runningRef.current = true;
      firedRef.current = false;
      holdRef.current = 0;
      lastRef.current = { t: performance.now(), frames: 0, fps: 0 };
      setStatus("ready");
      loop();
    } catch (e) {
      stop();
      setStatus("error");
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Bạn đã từ chối quyền dùng camera. Có thể cấp lại quyền trong thanh địa chỉ, hoặc dùng nút Tải ảnh từ máy bên dưới."
          : e instanceof Error && e.name === "NotFoundError"
            ? "Không tìm thấy camera nào trên thiết bị. Dùng nút Tải ảnh từ máy bên dưới."
            : "Không bật được camera: " +
              (e instanceof Error ? e.message : String(e)) +
              ". Bạn vẫn có thể dùng nút Tải ảnh từ máy."
      );
    }
  }, [loop, stop]);

  const goAnalyze = useCallback(
    (f: FaceFeatures, lm: Landmark[], snapshot: string | null) => {
      saveScan({
        features: f,
        snapshot,
        landmarks: lm.map((p) => ({ x: p.x, y: p.y })),
      });
      stop();
      router.push("/analyze");
    },
    [router, stop]
  );

  const capture = useCallback(() => {
    const latest = latestRef.current;
    const video = videoRef.current;
    if (!latest || !video) return;
    setBusy(true);
    // Vẽ khung hình hiện tại ra canvas rồi lấy data URL — vẫn ở trong máy.
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")?.drawImage(video, 0, 0);
    let snapshot: string | null = null;
    try {
      snapshot = c.toDataURL("image/jpeg", 0.8);
    } catch {
      snapshot = null;
    }
    goAnalyze(latest.features, latest.landmarks, snapshot);
  }, [goAnalyze]);

  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  const onUpload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        await getLandmarker();
        const img = await loadImageFile(file);
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d")?.drawImage(img, 0, 0);

        const lm = await detectFromImage(c);
        if (!lm) {
          setBusy(false);
          setError("Không tìm thấy khuôn mặt trong ảnh này. Thử ảnh chính diện, rõ mặt.");
          return;
        }
        const measure = canvasRef.current ?? document.createElement("canvas");
        const brightness = measureBrightness(c, measure);
        const f = extractFeatures(lm, { brightness });
        goAnalyze(f, lm, c.toDataURL("image/jpeg", 0.8));
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [goAnalyze]
  );

  const q = features?.quality;
  const ok = Boolean(features?.quality.ok);
  const canCapture = ok && !busy;

  return (
    // Màn 02 dùng nền SÁNG như mọi màn khác — chủ dự án quyết ngày 14/09/2026.
    // CLAUDE.md mục 5 trước đây xếp màn này vào nền tối; bảng đó đã được sửa cho
    // khớp. Đừng "sửa lại cho đúng đặc tả" khi thấy lệch, hỏi trước.
    //
    // Chỉ riêng KHUNG CAMERA giữ nền tối, và đó không phải lựa chọn thẩm mỹ:
    // nó chứa thẻ <video>, còn lưới điểm mốc thì vẽ bằng màu sáng — đặt lưới
    // lên nền trắng là mất hút. Nền tối cũng là thứ lấp chỗ trống trong lúc
    // camera chưa kịp trả khung hình đầu tiên.
    //
    // min-h trừ đúng chiều cao header (h-20 / sm:h-26) để trang không co lại
    // ngắn hơn màn hình khi camera chưa bật.
    <main className="min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-6.5rem)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:px-10">
        <div className="reveal flex flex-col gap-2">
          <span className="label-caps">Màn 02</span>
          <h1 className="text-3xl sm:text-4xl">Quét gương mặt</h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Khung camera */}
          <div
            className={
              "reveal d-1 relative aspect-4/3 w-full overflow-hidden rounded-panel bg-dark-base transition-shadow duration-500 " +
              (ok
                ? "shadow-[0_0_0_2px_rgba(74,222,128,0.55),0_28px_60px_-30px_rgba(74,222,128,0.55)]"
                : "shadow-[0_0_0_1px_rgba(14,26,60,0.16),0_28px_60px_-34px_rgba(14,26,60,0.5)]")
            }
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* Canvas đo độ sáng — không hiển thị. */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Lưới điểm mốc. Lật gương CÙNG CHIỀU với thẻ video ở trên, nếu
                không lưới sẽ nằm đối xứng ngược so với khuôn mặt đang thấy. */}
            <canvas
              ref={meshRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ transform: "scaleX(-1)" }}
            />

            {status === "ready" && (
              <>
                {/* Khung căn mặt, kèm quầng lan ra khi đã bắt đúng mặt. */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[70%] w-[42%]">
                    <div
                      className="absolute inset-0 border-2 transition-colors duration-300"
                      style={{
                        borderRadius: "50% / 58%",
                        borderColor: ok ? "#4ADE80" : "#F0A81E",
                      }}
                    />
                    {/* Tín hiệu nhìn được từ cuối hội trường, không cần đọc chữ. */}
                    {ok && (
                      <div
                        aria-hidden
                        className="absolute inset-0 animate-[fp-halo_1.6s_ease-out_infinite] border-2 border-[#4ADE80]"
                        style={{ borderRadius: "50% / 58%" }}
                      />
                    )}
                  </div>
                </div>

                <HoldRing ringRef={ringRef} countRef={countRef} />
              </>
            )}

            {status !== "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                {status === "loading" ? (
                  <>
                    <span
                      aria-hidden
                      className="h-7 w-7 animate-[fp-spin_0.9s_linear_infinite] rounded-full border-2 border-white/20 border-t-sky"
                    />
                    <p className="text-sm text-on-dark-muted">Đang nạp model nhận diện…</p>
                  </>
                ) : (
                  <>
                    <p className="max-w-sm text-sm text-on-dark-muted">
                      Cần quyền dùng camera. Ảnh được xử lý ngay trên máy bạn và
                      không gửi đi đâu cả.
                    </p>
                    <button
                      onClick={start}
                      className="btn-primary rounded-btn px-7 py-3.5 text-sm font-semibold"
                    >
                      Bật camera
                    </button>
                  </>
                )}
              </div>
            )}

            {status === "ready" && (
              <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
                <Badge ok={q ? q.landmarks >= QUALITY_LIMITS.minLandmarks : false}>
                  {q?.landmarks ?? 0}/{TOTAL_LANDMARKS} điểm mốc
                </Badge>
                <Badge ok={fps >= 10}>{fps} fps</Badge>
                <Badge ok={q ? Math.abs(q.headTiltDeg) <= QUALITY_LIMITS.maxHeadTiltDeg : false}>
                  nghiêng {q ? q.headTiltDeg.toFixed(0) : "–"}°
                </Badge>
                <Badge ok={q ? q.brightness >= QUALITY_LIMITS.minBrightness : false}>
                  sáng {q ? Math.round(q.brightness * 100) : 0}%
                </Badge>
              </div>
            )}

            {status === "ready" && (
              <div className="pointer-events-none absolute bottom-4 left-4">
                <span
                  className={
                    "rounded-btn px-3.5 py-2 text-xs font-semibold backdrop-blur-sm transition-colors duration-300 " +
                    (ok ? "bg-[#4ADE80] text-dark-base" : "bg-black/55 text-white/80")
                  }
                >
                  {features
                    ? ok
                      ? auto
                        ? "Đủ điều kiện — giữ yên để tự chụp"
                        : "Đủ điều kiện chụp"
                      : "Chưa đủ điều kiện chụp"
                    : "Chưa thấy khuôn mặt"}
                </span>
              </div>
            )}
          </div>

          {/* Panel bên phải */}
          <div className="reveal d-2 flex flex-col gap-5">
            <p className="text-sm font-light leading-relaxed text-ink-muted">
              Ánh sáng chính diện, bỏ kính, tóc không che phần lông mày, giữ yên trong 3 giây.
            </p>

            <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
              <span className="label-caps">Đặc trưng đang đọc</span>
              {LIVE.map(({ label, get }) => (
                <LiveMetric
                  key={label}
                  label={label}
                  value={features ? get(features) : null}
                />
              ))}
            </div>

            {error && (
              <div className="rounded-card border border-line-strong bg-surface px-4 py-3 text-xs leading-relaxed text-ink-body">
                {error}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2">
              {/* Tự chụp bật sẵn cho gian trải nghiệm ở hội trại: người đứng
                  trước camera không phải với tay bấm chuột. Vẫn để tắt được —
                  lúc demo trên sân khấu thì người trình bày cần tự quyết định
                  thời điểm chụp. */}
              {status === "ready" && (
                <label className="flex cursor-pointer items-center gap-2.5 pb-1 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={auto}
                    onChange={(e) => setAuto(e.target.checked)}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  Tự chụp sau khi giữ yên 3 giây
                </label>
              )}

              <button
                onClick={capture}
                disabled={!canCapture}
                className={
                  "rounded-btn px-6 py-3.5 text-[15px] font-semibold transition-all duration-300 " +
                  (canCapture ? "btn-primary" : "cursor-not-allowed bg-line-soft text-ink-faintest")
                }
              >
                {busy ? "Đang xử lý…" : "Chụp và phân tích"}
              </button>

              <label className="cursor-pointer rounded-btn border border-line-strong bg-card px-6 py-3 text-center text-sm text-blue-deep transition-all duration-300 hover:-translate-y-0.5 hover:border-blue hover:shadow-[0_14px_28px_-18px_rgba(37,99,235,0.7)]">
                Tải ảnh từ máy
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>

              <Link
                href="/"
                className="py-1 text-center text-xs text-ink-faintest transition-colors hover:text-blue-deep"
              >
                Quay lại trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Vòng đếm ngược 3 giây ở góc phải dưới khung camera.
 *
 * Không nhận prop tiến độ: vòng lặp nhận diện ghi thẳng vào `strokeDashoffset`
 * qua ref (paintHold) để khỏi phải dựng lại React mỗi khung hình. Chu vi được
 * nhét vào `data-len` cho paintHold đọc, khỏi lặp lại con số ở hai nơi.
 */
function HoldRing({
  ringRef,
  countRef,
}: {
  ringRef: React.RefObject<SVGCircleElement | null>;
  countRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const R = 26;
  const LEN = 2 * Math.PI * R;
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="4"
        />
        <circle
          ref={ringRef}
          data-len={LEN}
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="#4ADE80"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN}
        />
      </svg>
      <span
        ref={countRef}
        className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums text-[#4ADE80]"
      />
    </div>
  );
}

/** Một chỉ số live: con số + thanh tỉ lệ, để nhìn từ xa vẫn thấy nó đang đổi. */
function LiveMetric({ label, value }: { label: string; value: number | null }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-body">{label}</span>
        <span className="font-semibold tabular-nums text-ink-title">
          {value === null ? "—" : value.toFixed(2)}
        </span>
      </div>
      {/* Thanh chỉ vẽ lại con số ngay bên trên nên ẩn khỏi trình đọc màn hình. */}
      <div className="h-1 overflow-hidden rounded-full bg-line-soft" aria-hidden>
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#38BDF8,#7C5CFF)] transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        "rounded-btn px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm transition-colors duration-300 " +
        (ok ? "bg-black/55 text-[#4ADE80]" : "bg-black/55 text-white/60")
      }
    >
      {children}
    </span>
  );
}
