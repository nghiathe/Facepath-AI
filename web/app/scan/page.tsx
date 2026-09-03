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

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const lastRef = useRef({ t: 0, frames: 0, fps: 0 });
  const latestRef = useRef<{ features: FaceFeatures; landmarks: Landmark[] } | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FaceFeatures | null>(null);
  const [fps, setFps] = useState(0);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => stop, [stop]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const tick = async () => {
      if (!runningRef.current || !video || !canvas) return;
      if (video.readyState >= 2) {
        try {
          const lm = await detectFromVideo(video, performance.now());
          if (lm) {
            const brightness = measureBrightness(video, canvas);
            const f = extractFeatures(lm, { brightness });
            latestRef.current = { features: f, landmarks: lm };
            setFeatures(f);
          } else {
            latestRef.current = null;
            setFeatures(null);
          }
        } catch {
          /* bỏ qua khung lỗi lẻ, khung sau thử lại */
        }

        const now = performance.now();
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
  }, []);

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
  const canCapture = Boolean(features?.quality.ok) && !busy;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <span className="label-caps">Màn 02</span>
        <h1 className="text-3xl sm:text-4xl">Quét gương mặt</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Khung camera */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card bg-navy-darkest">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Khung căn mặt */}
          {status === "ready" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="h-[70%] w-[42%] border-2"
                style={{
                  borderRadius: "50% / 58%",
                  borderColor: features?.quality.ok ? "#4ADE80" : "#F0A81E",
                }}
              />
            </div>
          )}

          {status !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              {status === "loading" ? (
                <p className="text-sm text-white/70">Đang nạp model nhận diện…</p>
              ) : (
                <>
                  <p className="max-w-sm text-sm text-white/70">
                    Cần quyền dùng camera. Ảnh được xử lý ngay trên máy bạn và
                    không gửi đi đâu cả.
                  </p>
                  <button
                    onClick={start}
                    className="rounded-btn bg-amber px-6 py-3 text-sm font-semibold text-navy-darkest"
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
                  "rounded-btn px-3 py-1.5 text-xs font-semibold " +
                  (features?.quality.ok
                    ? "bg-[#4ADE80] text-navy-darkest"
                    : "bg-black/65 text-white/80")
                }
              >
                {features
                  ? features.quality.ok
                    ? "Đủ điều kiện chụp"
                    : "Chưa đủ điều kiện chụp"
                  : "Chưa thấy khuôn mặt"}
              </span>
            </div>
          )}
        </div>

        {/* Panel bên phải */}
        <div className="flex flex-col gap-5">
          <p className="text-sm font-light leading-relaxed text-ink-muted">
            Ánh sáng chính diện, bỏ kính, tóc không che cung mày, giữ yên 2 giây.
          </p>

          <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
            <span className="label-caps">Đặc trưng đang đọc</span>
            {LIVE.map(({ label, get }) => (
              <div key={label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-body">{label}</span>
                <span className="font-semibold tabular-nums text-navy">
                  {features ? get(features).toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-card bg-surface px-4 py-3 text-xs leading-relaxed text-ink-faintest">
            Chỉ {SUPPORTED_KEYS.length} chỉ số được dùng để đối chiếu. Ảnh và khung
            hình <strong className="font-semibold text-ink-muted">không rời thiết bị</strong> —
            toàn bộ việc đo và khớp luật chạy ngay trong trình duyệt.
          </div>

          {error && (
            <div className="rounded-card border border-line-strong bg-surface px-4 py-3 text-xs leading-relaxed text-ink-body">
              {error}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={capture}
              disabled={!canCapture}
              className={
                "rounded-btn px-6 py-3.5 text-[15px] font-semibold transition-colors " +
                (canCapture
                  ? "bg-navy text-white hover:bg-navy-deep"
                  : "cursor-not-allowed bg-line-soft text-ink-faintest")
              }
            >
              {busy ? "Đang xử lý…" : "Chụp và phân tích"}
            </button>

            <label className="cursor-pointer rounded-btn border border-line-strong px-6 py-3 text-center text-sm text-navy transition-colors hover:border-navy">
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
              className="py-1 text-center text-xs text-ink-faintest hover:text-navy"
            >
              Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        "rounded-btn px-2.5 py-1 text-[11px] font-medium " +
        (ok ? "bg-black/65 text-[#4ADE80]" : "bg-black/65 text-white/60")
      }
    >
      {children}
    </span>
  );
}
