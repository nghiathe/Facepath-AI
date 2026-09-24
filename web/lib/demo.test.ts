import { describe, expect, it } from "vitest";
import { RULES } from "./data";
import { DEMO_SCAN } from "./demo";
import { CATEGORICAL, NUMERIC, readKeys } from "./engine/accessors";
import { analyzeFeatures } from "./engine/analyze";

// Phiếu mẫu (nút "Xem kết quả mẫu" ở trang chủ, đường /result?demo=1).
//
// VÌ SAO ĐÁNG MỘT FILE TEST RIÊNG: đây là đường mà người xem bấm vào nhiều nhất
// khi ứng dụng được chiếu lên màn lớn — và cũng là đường duy nhất KHÔNG đi qua
// camera, nên gãy mà không ai biết. Nó từng gãy thật: DEMO_SCAN được viết ra
// nhưng không chỗ nào import, nút trỏ thẳng vào /result và phiên mới mở thì chỉ
// hiện "Chưa có phiếu nào".
//
// Các test dưới đây kiểm đúng những gì màn 04 đọc ra để dựng phiếu. Cố tình
// KHÔNG chốt cứng giá trị cụ thể (bao nhiêu luật khớp, nhóm nào dẫn đầu): sửa
// data/rules.json là những số đó đổi theo, mà đổi như vậy là chuyện bình thường.
describe("phiếu mẫu", () => {
  // engine.test.ts đã kiểm "mọi feature_key trong rules đều có accessor". Ở đây
  // kiểm một việc khác: chạy các accessor đó TRÊN CHÍNH bộ số mẫu, để bắt
  // trường hợp DEMO_FEATURES thiếu một nhánh nào đó (vd quên `forehead.shape`)
  // — thiếu thì accessor trả undefined, luật im lặng không khớp, và phiếu mẫu
  // nghèo đi mà không có lỗi nào nổ ra.
  it("bộ số mẫu đọc được ở mọi chỉ số mà bộ luật dùng tới", () => {
    const f = DEMO_SCAN.features;
    // readKeys: luật ghép (op="all") đọc các vế của nó chứ không đọc chính
    // feature_key "brow_kiem" — cái đó chỉ là tên của tướng.
    const unreadable = [...new Set(RULES.flatMap(readKeys))]
      .filter((key) => {
        const read = NUMERIC[key] ?? CATEGORICAL[key];
        return read === undefined || read(f) === undefined;
      })
      .sort();
    expect(unreadable).toEqual([]);
  });

  it("không kèm ảnh — phiếu mẫu không được dùng mặt của người thật", () => {
    expect(DEMO_SCAN.snapshot).toBeNull();
    expect(DEMO_SCAN.landmarks).toBeNull();
  });

  it("dựng ra một phiếu đầy đủ, không phải màn hình trống", () => {
    const r = analyzeFeatures(DEMO_SCAN.features);

    expect(r.archetype).toBeTruthy();
    expect(r.matchedRulesCount).toBeGreaterThan(0);
    expect(r.sourcesCount).toBeGreaterThan(0);
    expect(r.reading.length).toBeGreaterThan(80);

    // Màn 04 đọc thẳng result.careers[0] để dựng badge "Nhóm nghề dẫn đầu";
    // mảng rỗng là trang nổ ngay khi mở.
    expect(r.careers.length).toBeGreaterThan(0);
    expect(r.careers[0].percent).toBeGreaterThan(0);

    // Mỗi thẻ trait phải có ít nhất một luật kèm nguồn: màn 04 đọc
    // t.rules[0].hint / .source / .citation mà không kiểm tra gì trước.
    expect(r.traits.length).toBeGreaterThan(0);
    for (const t of r.traits) {
      expect(t.rules[0]).toBeDefined();
      expect(t.rules[0].source).toBeTruthy();
      expect(t.rules[0].citation).toBeTruthy();
    }
  });

  it("nhóm nghề đã xếp từ cao xuống thấp", () => {
    const percents = analyzeFeatures(DEMO_SCAN.features).careers.map(
      (c) => c.percent
    );
    expect([...percents].sort((a, b) => b - a)).toEqual(percents);
  });
});
