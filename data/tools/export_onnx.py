"""
Xuất best_model.pth → ONNX để chạy trên trình duyệt (lib/modelInference.ts).

  pip install torch torchvision onnx onnxruntime onnxscript
  python export_onnx.py best_model.pth --out faceshape_b4

Mặc định sinh hai file, và TỰ KIỂM bằng cách so xác suất với PyTorch:
  faceshape_b4.onnx        ~67 MB  fp32, bản đối chứng
  faceshape_b4_fp16.onnx   ~34 MB  nên dùng cho web — đo được Δprob < 0.002

`--int8` sinh thêm bản lượng tử hoá động ~17 MB. ĐỪNG DÙNG nếu chưa đọc mục
"Vì sao int8 hỏng" bên dưới; script sẽ báo đỏ và thoát khác 0 nếu bản nào lệch.

--- Vì sao int8 hỏng (đo ngày 23/09/2026) ------------------------------------
`quantize_dynamic` biến mọi Conv thành ConvInteger và lượng tử hoá activation
theo từng tensor mà KHÔNG có bộ calibration. EfficientNet dùng depthwise conv +
SiLU, dải activation rất rộng, nên model sập hẳn: trên 50 đầu vào thử, bản int8
luôn trả đúng một lớp ("Round") với xác suất ~0.9, argmax khớp fp32 0/20 lần.
Bật `per_channel=True` (cả QUInt8 lẫn QInt8) không cứu được — vẫn sập về Round.

Muốn thật sự có int8 thì phải lượng tử hoá TĨNH với một tập calibration ảnh
chân dung thật (vài trăm ảnh từ chính bộ Kaggle), dùng
`onnxruntime.quantization.quantize_static`. Chưa có tập đó thì fp16 là lựa chọn
đúng: nhỏ bằng một nửa fp32 và gần như không mất độ chính xác.

--- Vì sao dynamo=False ------------------------------------------------------
torch >= 2.9 mặc định dùng exporter mới; nó tách trọng số ra file .onnx.data
riêng 68 MB và sinh graph mà onnx.shape_inference không nuốt được ("Inferred
shape and existing shape differ in dimension 0: (1792) vs (5)"). Cả hai đều
hỏng cho trình duyệt: modelInference.ts nạp đúng MỘT file. Exporter cũ
(TorchScript) cho một file tự chứa. Khi nào torch bỏ hẳn dynamo=False thì phải
nhúng lại external data (onnx.save_model(..., save_as_external_data=False)).
"""

import argparse
import sys
import warnings

import numpy as np
import torch
import torchvision

warnings.filterwarnings("ignore")

ap = argparse.ArgumentParser()
ap.add_argument("weights")
ap.add_argument("--out", default="faceshape_b4")
ap.add_argument("--int8", action="store_true", help="sinh thêm bản int8 (đã biết là hỏng)")
ap.add_argument("--samples", type=int, default=30, help="số đầu vào dùng để tự kiểm")
a = ap.parse_args()

m = torchvision.models.efficientnet_b4(weights=None)
m.classifier = torch.nn.Sequential(torch.nn.Dropout(p=0.3, inplace=True), torch.nn.Linear(1792, 5))  # như notebook
m.load_state_dict(torch.load(a.weights, map_location="cpu", weights_only=True), strict=True)
m.eval()

x = torch.randn(1, 3, 224, 224)
torch.onnx.export(m, x, f"{a.out}.onnx", input_names=["input"], output_names=["logits"],
                  opset_version=17, dynamo=False)   # xem ghi chú ở docstring

import onnx                                          # noqa: E402
import onnxruntime as ort                            # noqa: E402
from onnxruntime.transformers.float16 import convert_float_to_float16  # noqa: E402

# keep_io_types: vào/ra vẫn là fp32 nên modelInference.ts không phải đổi gì.
onnx.save(convert_float_to_float16(onnx.load(f"{a.out}.onnx"), keep_io_types=True),
          f"{a.out}_fp16.onnx")

variants = [f"{a.out}.onnx", f"{a.out}_fp16.onnx"]
if a.int8:
    from onnxruntime.quantization import QuantType, quantize_dynamic
    quantize_dynamic(f"{a.out}.onnx", f"{a.out}_int8.onnx", weight_type=QuantType.QUInt8)
    variants.append(f"{a.out}_int8.onnx")

# --- Tự kiểm ----------------------------------------------------------------
# Một tensor ngẫu nhiên là quá ít: bản int8 sập về một lớp cố định vẫn có thể
# "đúng" nếu tensor đó tình cờ rơi vào lớp ấy. Thử nhiều đầu vào, và theo dõi cả
# việc model có trả về NHIỀU HƠN MỘT lớp hay không.
rng = np.random.default_rng(0)


def sample(i: int) -> np.ndarray:
    """Nửa đầu là nhiễu trơn giống ảnh, nửa sau là nhiễu trắng."""
    if i % 2:
        return rng.standard_normal((1, 3, 224, 224), dtype=np.float32)
    small = rng.random((3, 7, 7)).astype("float32")
    big = np.kron(small, np.ones((32, 32), "float32"))
    mean = np.array([.485, .456, .406], "float32")[:, None, None]
    std = np.array([.229, .224, .225], "float32")[:, None, None]
    return ((big - mean) / std)[None].astype("float32")


xs = [sample(i) for i in range(a.samples)]
with torch.no_grad():
    ref = [torch.softmax(m(torch.from_numpy(v)), 1).numpy() for v in xs]

# Ngưỡng: lệch xác suất bao nhiêu thì coi là hỏng, và khoảng cách top1-top2 bao
# nhiêu thì một lần đảo argmax mới đáng kể. Đảo argmax lúc hai lớp gần bằng nhau
# là chuyện bình thường của fp16, không phải lỗi; đảo khi fp32 đang chắc chắn
# mới là hỏng.
MAX_DELTA, TIE_MARGIN = 0.01, 0.02

ref_classes = len({int(r.argmax()) for r in ref})
failed = []
for f in variants:
    sess = ort.InferenceSession(f)
    dmax, preds, real_flips, ties = [], set(), 0, 0
    for v, r in zip(xs, ref):
        o = sess.run(None, {"input": v})[0]
        p = np.exp(o - o.max(1, keepdims=True))
        p /= p.sum(1, keepdims=True)
        dmax.append(float(np.abs(p - r).max()))
        preds.add(int(p.argmax()))
        if p.argmax() != r.argmax():
            top2 = np.sort(r[0])[::-1]
            if top2[0] - top2[1] > TIE_MARGIN:
                real_flips += 1
            else:
                ties += 1

    # "sập về một lớp" là triệu chứng riêng của int8, bắt hẳn bằng một điều kiện.
    collapsed = ref_classes > 1 and len(preds) == 1
    ok = max(dmax) < MAX_DELTA and real_flips == 0 and not collapsed
    note = f" | đảo do sát nút: {ties}" if ties else ""
    print(f"{'OK  ' if ok else 'HỎNG'} {f:26s} Δprob max {max(dmax):.5f} "
          f"| đảo argmax thật sự: {real_flips} | lớp dự đoán được: {len(preds)}/{ref_classes}{note}")
    if not ok:
        failed.append(f)

if failed:
    print(f"\nKHÔNG ĐƯỢC ĐEM LÊN WEB: {', '.join(failed)} — xem docstring đầu file.")
    sys.exit(1)
