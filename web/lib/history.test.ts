import { beforeEach, describe, expect, it } from "vitest";
import type { FaceFeatures } from "./features/types";

// history.ts đọc/ghi localStorage. Test chạy ở môi trường node (vitest.config)
// nên phải dựng sẵn window + localStorage giả TRƯỚC khi import module — module
// kiểm tra `typeof window` ngay lúc gọi hàm.
class FakeStorage {
  private map = new Map<string, string>();
  /** Chặn ghi khi vượt ngưỡng, để thử nhánh "hết dung lượng". */
  limit = Infinity;

  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (v.length > this.limit) throw new Error("QuotaExceededError");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const storage = new FakeStorage();
Object.assign(globalThis, {
  localStorage: storage,
  window: { addEventListener() {}, removeEventListener() {} },
});

const { addHistory, clearHistory, listHistory, MAX_ENTRIES, removeHistory } =
  await import("./history");

const features = { faceType: "kim" } as unknown as FaceFeatures;

const entry = (at: number, over: Record<string, unknown> = {}) => ({
  at,
  archetype: "Mặt chữ Nhật — kim hình",
  ducTinh: "Nghĩa",
  matchedRulesCount: 12,
  totalRulesCount: 32,
  sourcesCount: 7,
  lead: { slug: "ky-thuat-cong-nghe", name: "Kỹ thuật & công nghệ", percent: 71 },
  traits: ["Kiên định, bền chí"],
  features,
  landmarks: null,
  ...over,
});

describe("lịch sử quét", () => {
  beforeEach(() => {
    storage.limit = Infinity;
    clearHistory();
  });

  it("thêm rồi đọc lại được, mới nhất lên đầu", () => {
    addHistory(entry(1000));
    addHistory(entry(2000, { archetype: "Mặt chữ Điền — thổ hình" }));
    expect(listHistory().map((e) => e.at)).toEqual([2000, 1000]);
  });

  it("cùng một lượt quét thì ghi đè, không nhân bản", () => {
    // Màn phiếu ghi lịch sử mỗi lần mount (StrictMode mount hai lần ở dev, và
    // mở lại phiếu cũ giữ nguyên `at`) — không được đẻ ra bản sao.
    addHistory(entry(1000));
    addHistory(entry(1000, { matchedRulesCount: 13 }));
    const all = listHistory();
    expect(all).toHaveLength(1);
    expect(all[0].matchedRulesCount).toBe(13);
  });

  it("chỉ giữ MAX_ENTRIES lượt gần nhất", () => {
    for (let i = 1; i <= MAX_ENTRIES + 5; i++) addHistory(entry(i * 1000));
    const all = listHistory();
    expect(all).toHaveLength(MAX_ENTRIES);
    expect(all[0].at).toBe((MAX_ENTRIES + 5) * 1000);
    expect(all.at(-1)?.at).toBe(6 * 1000); // 5 lượt cũ nhất đã rơi ra
  });

  it("làm tròn toạ độ điểm mốc về 4 chữ số", () => {
    addHistory(entry(1000, { landmarks: [{ x: 0.123456789, y: 0.987654321 }] }));
    expect(listHistory()[0].landmarks).toEqual([{ x: 0.1235, y: 0.9877 }]);
  });

  it("hết dung lượng thì bỏ điểm mốc chứ không mất cả mục", () => {
    const landmarks = Array.from({ length: 478 }, (_, i) => ({ x: i / 478, y: 0.5 }));
    storage.limit = 2000; // đủ cho phần chỉ số, không đủ cho 478 điểm mốc
    addHistory(entry(1000, { landmarks }));
    const all = listHistory();
    expect(all).toHaveLength(1);
    expect(all[0].landmarks).toBeNull();
    expect(all[0].matchedRulesCount).toBe(12);
  });

  it("xoá một mục và xoá tất cả", () => {
    addHistory(entry(1000));
    addHistory(entry(2000));
    removeHistory("1000");
    expect(listHistory().map((e) => e.at)).toEqual([2000]);
    clearHistory();
    expect(listHistory()).toEqual([]);
  });
});
