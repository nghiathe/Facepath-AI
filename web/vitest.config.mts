import { defineConfig } from "vitest/config";

// Engine và features là TypeScript thuần (không React, không DOM) nên chạy
// thẳng trong môi trường node. PIPELINE mục 5: "Engine này thuần, không phụ
// thuộc React, để test dễ".
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  server: {
    // data/ nằm ngoài web/ (ở gốc repo) nên phải cho Vite đọc lên thư mục cha.
    fs: { allow: [".."] },
  },
});
