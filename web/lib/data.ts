// Nạp và gắn kiểu cho dữ liệu ở /data/data-train (gốc repo, nằm ngoài web/).
//
// JSON được import tĩnh nên vào thẳng bundle: engine chạy được hoàn toàn ở
// client, không cần gọi mạng — đúng ràng buộc "ảnh không rời thiết bị"
// (CLAUDE.md mục 1), vì thậm chí bộ luật cũng không cần đi đâu cả.

import careersJson from "../../data/data-train/careers.json";
import faceTypesJson from "../../data/data-train/face_types.json";
import rulesJson from "../../data/data-train/rules.json";
import sourcesJson from "../../data/data-train/sources.json";
import type { FaceType } from "./features/types";
import type { Career } from "./engine/career";
import type { Rule } from "./engine/rule-engine";

export type Source = {
  id: string;
  title: string;
  author?: string;
  citation: string;
  note?: string;
  /**
   * "model" = KHÔNG phải nguồn tướng học, mà là một model máy học được ghi
   * nguồn riêng (data/README.md). Các trang tra cứu phải lọc loại này ra khỏi
   * danh mục cổ thư, nếu không sẽ thành trình bày kết quả model như lời sách.
   */
  type?: "model";
  /** Chỉ có ở nguồn type="model". */
  classes?: string[];
  input?: string;
  reported_accuracy?: number;
  caveats?: string[];
};

/** Nguồn tướng học thật — bỏ các mục type="model". */
export const isBookSource = (s: Source): boolean => s.type !== "model";

export type FaceTypeInfo = {
  key: FaceType;
  label: string; // vd "Mặt chữ Nhật — kim hình" -> dùng làm archetype trên phiếu
  trigger: string;
  duc_tinh: string; // ngũ thường: Nghĩa / Nhân / Trí / Lễ / Tín
  summary: string;
  reading: string;
  source: string;
  citation: string;
  /**
   * Vector z mẫu của hành này (chiều nào có mặt thì mới được so khớp).
   * features/shape.ts so khớp mềm đặc trưng đo được với các prototype này thay
   * cho ngưỡng cứng cũ — xem data/README.md, mục "Bản v4".
   */
  prototype?: Record<string, number>;
  /**
   * Lớp tương ứng của model Kaggle EfficientNet-B4. Rỗng = model không có lớp
   * cho hành này (Hoả, Thổ) nên chỉ nhận diện được bằng hình học.
   */
  model_classes?: string[];
  model_note?: string;
};

// Phải ép qua unknown: TypeScript suy kiểu JSON tĩnh thành union của từng
// object cụ thể (mỗi luật có tập khoá `careers` khác nhau) nên không tự khớp
// với Record<string, number>. Hình dạng dữ liệu được engine.test.ts kiểm tra
// lúc chạy test: đủ feature_key, nguồn tồn tại, slug nghề hợp lệ.
export const RULES = rulesJson as unknown as Rule[];
export const CAREERS = careersJson as unknown as Career[];
export const SOURCES = sourcesJson as unknown as Source[];

/**
 * Chỉ các nguồn tướng học — dùng cho mọi chỗ hiển thị "nguồn dẫn".
 *
 * sources.json từ bản v4 có thêm một mục type="model" (EfficientNet-B4 train
 * trên Kaggle FaceShape). Đó KHÔNG phải cổ thư: xếp chung vào danh sách dưới
 * câu "các cổ thư đều được trích lại trong Nhân Tướng Học" là trình bày sai
 * xuất xứ, đúng điều data/README.md dặn phải tránh.
 */
export const BOOK_SOURCES = SOURCES.filter(isBookSource);
export const FACE_TYPES = faceTypesJson as unknown as FaceTypeInfo[];

const sourceById = new Map(SOURCES.map((s) => [s.id, s]));
const faceTypeByKey = new Map(FACE_TYPES.map((f) => [f.key, f]));

/** Tra nguồn theo id mà rules.json tham chiếu (vd "may"). */
export const getSource = (id: string): Source | undefined => sourceById.get(id);

/** Archetype hiển thị trên phiếu, suy từ faceType đã phân loại. */
export const getFaceType = (key: FaceType): FaceTypeInfo | undefined =>
  faceTypeByKey.get(key);

/**
 * Nhãn nguồn đầy đủ để hiển thị, vd "Ma Y Thần Tướng — Q.I, Ngũ hành hình tướng".
 * Trả về chính id nếu không tra được, để lỗi dữ liệu lộ ra thay vì im lặng.
 */
export function formatSource(sourceId: string, citation: string): string {
  const s = sourceById.get(sourceId);
  return s ? s.title + " — " + citation : sourceId + " — " + citation;
}
