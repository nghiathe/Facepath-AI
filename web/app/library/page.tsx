"use client";

import { useEffect, useState } from "react";
import { getCareers, getHealth } from "@/lib/api";
import type { CareerGroup, HealthStatus } from "@/lib/types";

// Trang "Kho luận giải" (mốc 5) — ở mốc 1 mới chỉ nối dây web <-> API để
// kiểm chứng backend chạy và dữ liệu seed vào đúng.
// Fetch phía client nên `npm run build` không phụ thuộc backend có bật hay không.
export default function LibraryPage() {
  const [careers, setCareers] = useState<CareerGroup[] | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getHealth(), getCareers()])
      .then(([h, c]) => {
        setHealth(h);
        setCareers(c);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-14 sm:px-10 sm:py-20">
      <span className="label-caps">Trang phụ</span>
      <h1 className="text-3xl sm:text-4xl">Kho luận giải</h1>
      <p className="text-sm font-light text-ink-muted">
        Bản đầy đủ (tra cứu luật + nguồn dẫn) thuộc{" "}
        <strong className="font-semibold text-ink-title">mốc 5</strong>. Ở mốc 1, trang
        này dùng để kiểm chứng backend đã chạy và dữ liệu đã seed đúng.
      </p>

      {error && (
        <div className="rounded-card border border-line-strong bg-surface px-5 py-4 text-sm text-ink-body">
          <strong className="font-semibold text-ink-title">
            Chưa gọi được API.
          </strong>{" "}
          Chạy backend rồi tải lại trang:{" "}
          <code className="text-[13px] text-navy">
            uvicorn api.main:app --reload --port 8000
          </code>
          <p className="mt-2 text-[12.5px] text-ink-faintest">{error}</p>
        </div>
      )}

      {health && (
        <div className="rounded-card border border-line-soft bg-surface px-5 py-4 text-sm">
          <p className="text-ink-body">
            API: <strong className="font-semibold text-ink-title">{health.status}</strong>{" "}
            · DB: <strong className="font-semibold text-ink-title">{health.db}</strong> ·{" "}
            {/* Số chỉ số lấy từ API, không hard-code (mục 13). */}
            {health.feature_count} chỉ số khuôn mặt ·{" "}
            {health.rule_count ?? "?"} luật trong CSDL
          </p>
        </div>
      )}

      {careers && (
        <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
          {careers.map((c) => (
            <li key={c.slug} className="flex flex-col gap-1 py-4">
              <strong className="text-[15px] font-semibold text-ink-title">
                {c.name}
              </strong>
              <span className="text-[13.5px] font-light text-ink-muted">
                {c.sample_jobs}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!careers && !error && (
        <p className="text-sm text-ink-faintest">Đang tải…</p>
      )}
    </main>
  );
}
