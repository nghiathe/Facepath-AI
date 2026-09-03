import type { ReactNode } from "react";

// Khung tạm cho các màn chưa tới lượt dựng (CLAUDE.md mục 12).
// Ghi rõ màn này thuộc mốc nào để không ai tưởng là đã xong.
export default function MilestonePlaceholder({
  screen,
  title,
  milestone,
  children,
}: {
  screen: string;
  title: string;
  milestone: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-14 sm:px-10 sm:py-20">
      <span className="label-caps">{screen}</span>
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      <p className="rounded-card border border-line-soft bg-surface px-5 py-4 text-sm text-ink-muted">
        Màn này thuộc <strong className="font-semibold text-ink-title">{milestone}</strong>{" "}
        và chưa được dựng. Mốc 1 mới lo phần khung: Next.js + FastAPI + MySQL và seed
        dữ liệu.
      </p>
      {children}
    </main>
  );
}
