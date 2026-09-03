import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Next 16 tự sinh web/AGENTS.md và web/CLAUDE.md mỗi lần dev.
  // Tắt đi: spec thật của dự án là CLAUDE.md ở gốc repo, để hai file trùng tên
  // trong web/ chỉ gây nhầm lẫn.
  agentRules: false,

  turbopack: {
    // Bộ luật nằm ở <repo>/data/, tức NGOÀI web/. web/lib/data.ts import trực
    // tiếp các file JSON đó để engine chạy được hoàn toàn phía client. Mặc định
    // Turbopack lấy web/ làm gốc nên không resolve nổi đường dẫn đi lên;
    // trỏ root về gốc repo để cả hai lớp cùng đọc một nguồn sự thật, thay vì
    // nhân bản data/ vào trong web/.
    root: path.join(HERE, ".."),
  },
};

export default nextConfig;
