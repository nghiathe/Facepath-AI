import { describe, expect, it } from "vitest";
import { FACE_TYPES } from "../data";
import {
  CALIB_SHAPE,
  classifyHanh,
  fuseWithModel,
  KIEM_RATIO,
  MIN_EYE_SPAN_PX,
  MODEL_CLASSES,
  softMatch,
  toZ,
  type Proto,
} from "./shape";

// Phân loại ngũ hình bản v4 (data/README.md, mục "Bản v4").
//
// VÌ SAO CÓ FILE NÀY: bản trước dùng ngưỡng cứng trên faceW/faceH và cho ra
// Mộc/Hỏa với gần như mọi người thật. Các bài dưới đây chốt lại đúng ba tính
// chất khiến cách mới không rơi vào bẫy đó: so theo z-score (không so với số
// tuyệt đối), khớp mềm (ra xác suất, không ra nhãn cứng), và chiều nào thiếu
// dữ liệu thì bỏ qua chứ không phạt.

const PROTOS: Proto[] = FACE_TYPES.filter((f) => f.prototype).map((f) => ({
  key: f.key,
  prototype: f.prototype as Record<string, number>,
}));

/** Dựng vector z trùng khít prototype của một hành. */
const zOf = (key: string) => ({ ...(PROTOS.find((p) => p.key === key)!.prototype) });

describe("prototype trong face_types.json", () => {
  it("đủ cả năm hành và chiều nào cũng có mean/std để tính z", () => {
    expect(PROTOS.map((p) => p.key).sort()).toEqual(
      ["hoa", "kim", "moc", "tho", "thuy"].sort()
    );
    for (const p of PROTOS)
      for (const dim of Object.keys(p.prototype))
        expect(CALIB_SHAPE[dim], `${p.key}.${dim} thiếu trong calib_shape.json`)
          .toBeDefined();
  });
});

describe("toZ", () => {
  it("số đo bằng đúng mean thì z = 0", () => {
    const raw = Object.fromEntries(
      Object.entries(CALIB_SHAPE).map(([k, c]) => [k, c.mean])
    );
    for (const v of Object.values(toZ(raw))) expect(v).toBeCloseTo(0, 10);
  });

  it("lệch một std thì z = 1", () => {
    const z = toZ({ length: CALIB_SHAPE.length.mean + CALIB_SHAPE.length.std });
    expect(z.length).toBeCloseTo(1, 10);
  });

  it("chiều không có trong calib thì bỏ hẳn, không đoán bừa", () => {
    expect(toZ({ khong_co_that: 1.23 })).toEqual({});
  });
});

describe("classifyHanh", () => {
  it("vector trùng prototype nào thì ra đúng hành đó", () => {
    for (const p of PROTOS) {
      expect(classifyHanh(zOf(p.key), PROTOS).primary, p.key).toBe(p.key);
    }
  });

  it("xác suất là phân phối thật: không âm và cộng lại bằng 1", () => {
    const m = classifyHanh(zOf("kim"), PROTOS).membership;
    expect(m.reduce((a, b) => a + b.p, 0)).toBeCloseTo(1, 10);
    for (const s of m) expect(s.p).toBeGreaterThanOrEqual(0);
  });

  it("gọi tên kiêm hình khi hành thứ hai bám sát", () => {
    // Điểm giữa hai prototype Kim và Thổ: không hành nào trội hẳn.
    const kim = zOf("kim");
    const tho = zOf("tho");
    const mid: Record<string, number> = {};
    for (const k of new Set([...Object.keys(kim), ...Object.keys(tho)]))
      mid[k] = ((kim[k] ?? 0) + (tho[k] ?? 0)) / 2;

    const r = classifyHanh(mid, PROTOS);
    expect(r.secondary).not.toBeNull();
    expect(r.label).toContain("kiêm");
    expect(r.membership[1].p).toBeGreaterThanOrEqual(
      KIEM_RATIO * r.membership[0].p
    );
  });

  it("một hành trội rõ thì không gán kiêm hình", () => {
    const r = classifyHanh(zOf("moc"), PROTOS);
    expect(r.secondary).toBeNull();
    expect(r.label).not.toContain("kiêm");
  });
});

describe("softMatch", () => {
  it("thiếu quá nửa số chiều thì mẫu đó bị loại, không được đoán liều", () => {
    // Chỉ đo được 1 trong 5 chiều của Kim (prototype Kim có 5 chiều).
    const r = softMatch({ fh: 0.8 }, PROTOS);
    const kim = r.find((s) => s.key === "kim")!;
    expect(kim.p).toBe(0);
  });

  it("không chiều nào đo được thì mọi xác suất bằng 0, không nổ", () => {
    const r = softMatch({}, PROTOS);
    expect(r).toHaveLength(PROTOS.length);
    for (const s of r) expect(s.p).toBe(0);
  });

  it("z lệch cực đoan bị kẹp lại, nên một chiều nhiễu không lật kết quả", () => {
    const sane = classifyHanh(zOf("kim"), PROTOS);
    const spiky = classifyHanh({ ...zOf("kim"), round: 50 }, PROTOS);
    // round bị kẹp ở +3 chứ không phải 50, nên Kim vẫn còn trong nhóm dẫn đầu.
    expect(spiky.membership[0].p).toBeLessThan(sane.membership[0].p);
    expect(["kim", "tho"]).toContain(spiky.primary);
  });
});

describe("fuseWithModel", () => {
  const types = FACE_TYPES.filter((f) => f.prototype).map((f) => ({
    key: f.key,
    prototype: f.prototype as Record<string, number>,
    model_classes: f.model_classes,
  }));
  const geo = classifyHanh(zOf("kim"), PROTOS).membership;

  it("model không đủ tự tin thì giữ nguyên kết quả hình học", () => {
    const flat = MODEL_CLASSES.map(() => 1 / MODEL_CLASSES.length);
    const { fused, usedModel } = fuseWithModel(geo, flat, types);
    expect(usedModel).toBe(false);
    expect(fused).toEqual(geo);
  });

  it("Oval — lớp không ánh xạ — không đè Hoả/Thổ xuống", () => {
    // Model chỉ thấy Oval, mà Oval không ứng với hành nào. Toàn bộ khối xác
    // suất ấy được chia lại theo chính phân bố hình học, nên kết quả phải
    // TRÙNG KHÍT với hình học: Hoả và Thổ (model không có lớp) không mất gì.
    const oval = MODEL_CLASSES.map((c) => (c === "Oval" ? 1 : 0));
    const { fused, usedModel } = fuseWithModel(geo, oval, types);
    expect(usedModel).toBe(true);
    const before = Object.fromEntries(geo.map((s) => [s.key, s.p]));
    for (const s of fused) expect(s.p).toBeCloseTo(before[s.key], 10);
  });

  it("model chắc chắn Square thì Kim được cộng thêm", () => {
    const square = MODEL_CLASSES.map((c) => (c === "Square" ? 0.9 : 0.025));
    const { fused } = fuseWithModel(geo, square, types);
    const before = Object.fromEntries(geo.map((s) => [s.key, s.p]));
    expect(fused.find((s) => s.key === "kim")!.p).toBeGreaterThan(before.kim);
    expect(fused.reduce((a, b) => a + b.p, 0)).toBeCloseTo(1, 10);
  });
});

describe("hằng số ngưỡng", () => {
  it("giữ đúng giá trị mà bộ dữ liệu v4 giả định", () => {
    expect(KIEM_RATIO).toBe(0.7);
    expect(MIN_EYE_SPAN_PX).toBe(90);
    // Thứ tự lớp phải khớp class_to_idx lúc train, nếu không việc ánh xạ sang
    // ngũ hành sẽ lệch hàng loạt.
    expect([...MODEL_CLASSES]).toEqual([
      "Heart",
      "Oblong",
      "Oval",
      "Round",
      "Square",
    ]);
  });
});
