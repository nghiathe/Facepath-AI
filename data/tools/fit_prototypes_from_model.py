"""
Dùng model faceshape (Kaggle, EfficientNet-B4, 5 lớp) làm NHÃN YẾU để đề xuất chỉnh prototype hình học.

Script KHÔNG ghi đè face_types.json / face_letters.json. Nó xuất:
  - prototype_suggestions.json : vector z trung bình của từng lớp model + đề xuất prototype mới (có nguồn gốc)
  - agreement.csv              : bảng chéo nhãn hình học (ngũ hành) × nhãn model
  - per_image.csv              : vector số + nhãn từng ảnh (không có ảnh) để soát lại

Chỉ đụng tới phần HÌNH HỌC. trait / reading / citation / careers vẫn lấy từ sách, model không được sửa.

Cài đặt:
  pip install torch torchvision mediapipe pillow numpy pandas
  wget https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task

Chạy:
  python fit_prototypes_from_model.py --images ./faces --weights best_model.pth \
      --landmarker face_landmarker.task --calib ../data/calib_shape.json \
      --types ../data/face_types.json --letters ../data/face_letters.json --out ./model_fit

QUAN TRỌNG — kiểm tra trước khi chạy:
  --classes : thứ tự lớp lúc train. ImageFolder xếp theo alphabet nên mặc định Heart,Oblong,Oval,Round,Square.
  Theo notebook: class_to_idx = Heart 0, Oblong 1, Oval 2, Round 3, Square 4; test_transforms = Resize((224,224)) + ImageNet norm.
  Mặc định của script đã khớp notebook.
"""
import argparse, json, math, os, sys
import numpy as np

# ---------- đặc trưng hình học: bản Python của lib/shapeClassifier.ts (phải giữ đồng bộ) ----------
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
             152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
YAW_LIMIT, MIN_EYE_SPAN_PX = 0.12, 90

def _d(a, b): return float(np.hypot(*(a - b)))
def _ang(a, b, c):
    u, v = a - b, c - b
    return math.degrees(math.acos(np.clip(u @ v / (np.linalg.norm(u) * np.linalg.norm(v)), -1, 1)))

def extract_features(P):
    """P: mảng (478,2) toạ độ pixel. Trả về dict đặc trưng hoặc (None, lý do)."""
    a, b = P[33], P[263]
    th = -math.atan2(b[1] - a[1], b[0] - a[0]); R = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
    P = P @ R.T
    ck = _d(P[234], P[454])
    yaw = (_d(P[1], P[234]) - _d(P[1], P[454])) / ck
    if abs(yaw) > YAW_LIMIT: return None, "yaw"
    if _d(P[33], P[263]) < MIN_EYE_SPAN_PX: return None, "too_small"
    ov = P[FACE_OVAL]; x, y = ov[:, 0], ov[:, 1]
    area = 0.5 * abs(x @ np.roll(y, -1) - y @ np.roll(x, -1))
    bbox = (x.max() - x.min()) * (y.max() - y.min())
    eyeW = (_d(P[33], P[133]) + _d(P[263], P[362])) / 2
    f = dict(
        fh=_d(P[54], P[284]) / ck, temple=_d(P[21], P[251]) / ck, jaw=_d(P[172], P[397]) / ck,
        chin=_d(P[149], P[378]) / ck, length=_d(P[10], P[152]) / ck, round=area / bbox,
        jaw_angle=(_ang(P[234], P[172], P[152]) + _ang(P[454], P[397], P[152])) / 2,
        cheekbone_height=((P[168][1] + P[1][1]) / 2 - (P[117][1] + P[346][1]) / 2) / _d(P[168], P[1]),
        brow_tail_rise=((P[55][1] - P[70][1]) + (P[285][1] - P[300][1])) / 2 / eyeW,
        brow_gap=_d(P[55], P[285]) / eyeW,
        eye_tilt=((P[133][1] - P[33][1]) + (P[362][1] - P[263][1])) / 2 / eyeW,
    )
    return f, None

def soft_match(z, protos, T=0.5):
    s = []
    for pr in protos:
        allk = list(pr["prototype"]); dims = [k for k in allk if k in z]
        if any(k not in z for k in pr.get("required", [])) or len(dims) < 2 or len(dims) < 0.6 * len(allk):
            s.append(-np.inf); continue
        s.append(-np.mean([(np.clip(z[k], -3, 3) - pr["prototype"][k]) ** 2 for k in dims]))
    s = np.array(s); e = np.exp((s - s[np.isfinite(s)].max()) / T); e[~np.isfinite(s)] = 0
    return e / e.sum()

# Ánh xạ lớp Kaggle → khoá prototype. Oval không có tương đương rõ → chỉ báo cáo, không đề xuất.
# Không lớp nào ứng với Hỏa / Thổ → prototype của hai hành này KHÔNG được chỉnh bằng model.
CLASS_MAP = {
    "Oblong": {"hanh": "moc", "letter": "muc"},
    "Round":  {"hanh": "thuy", "letter": "vien"},
    "Square": {"hanh": "kim", "letter": "dien"},
    "Heart":  {"hanh": None, "letter": "giap"},   # Heart ≈ Giáp; không chỉnh prototype Mộc (Mộc đã dùng Oblong)
    "Oval":   {"hanh": None, "letter": None},
}
SHAPE_DIMS = ["fh", "jaw", "chin", "length", "round", "jaw_angle"]

# ---------- model ----------
def load_model(weights, n_classes):
    import torch, torchvision
    m = torchvision.models.efficientnet_b4(weights=None)
    m.classifier[1] = torch.nn.Linear(m.classifier[1].in_features, n_classes)
    sd = torch.load(weights, map_location="cpu", weights_only=True)
    if isinstance(sd, dict) and "state_dict" in sd: sd = sd["state_dict"]
    m.load_state_dict(sd, strict=True)
    return m.eval()

def make_transform(size, mode):
    from torchvision import transforms as T
    norm = T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    if mode == "resize":      return T.Compose([T.Resize((size, size)), T.ToTensor(), norm])
    if mode == "resize_crop": return T.Compose([T.Resize(int(size * 1.143)), T.CenterCrop(size), T.ToTensor(), norm])
    raise ValueError(mode)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True); ap.add_argument("--weights", required=True)
    ap.add_argument("--landmarker", required=True); ap.add_argument("--calib", required=True)
    ap.add_argument("--types", required=True); ap.add_argument("--letters", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--classes", default="Heart,Oblong,Oval,Round,Square")
    ap.add_argument("--img-size", type=int, default=224)   # theo notebook
    ap.add_argument("--resize-mode", default="resize", choices=["resize", "resize_crop"])
    ap.add_argument("--min-conf", type=float, default=0.6, help="chỉ dùng ảnh model tự tin >= ngưỡng này")
    ap.add_argument("--blend", type=float, default=0.5, help="trọng số của vector đo được khi trộn với prototype cũ")
    ap.add_argument("--min-n", type=int, default=30)
    a = ap.parse_args()

    import torch, pandas as pd, mediapipe as mp
    from PIL import Image
    classes = a.classes.split(",")
    model = load_model(a.weights, len(classes)); tf = make_transform(a.img_size, a.resize_mode)
    calib = {k: v for k, v in json.load(open(a.calib)).items() if not k.startswith("_")}
    types, letters = json.load(open(a.types)), json.load(open(a.letters))

    opts = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=a.landmarker), num_faces=1)
    lmk = mp.tasks.vision.FaceLandmarker.create_from_options(opts)

    rows, skipped = [], {}
    files = [f for f in sorted(os.listdir(a.images)) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
    for fn in files:
        img = Image.open(os.path.join(a.images, fn)).convert("RGB")
        res = lmk.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(img)))
        if not res.face_landmarks: skipped["no_face"] = skipped.get("no_face", 0) + 1; continue
        P = np.array([[p.x * img.width, p.y * img.height] for p in res.face_landmarks[0]])
        f, why = extract_features(P)
        if f is None: skipped[why] = skipped.get(why, 0) + 1; continue
        # Ảnh Kaggle là chân dung nguyên khung → cắt rộng (có tóc) giống lib/modelInference.ts portraitBox
        x0, y0 = P.min(0); x1, y1 = P.max(0); fw, fh = x1 - x0, y1 - y0
        crop = img.crop((max(0, x0 - .35 * fw), max(0, y0 - .6 * fh), min(img.width, x1 + .35 * fw), min(img.height, y1 + .25 * fh)))
        with torch.no_grad():
            prob = torch.softmax(model(tf(crop).unsqueeze(0)), 1)[0].numpy()
        z = {k: (v - calib[k]["mean"]) / calib[k]["std"] for k, v in f.items() if k in calib}
        hp = soft_match(z, types)
        rows.append({"file": fn, **{f"raw_{k}": v for k, v in f.items()}, **{f"z_{k}": v for k, v in z.items()},
                     "model_label": classes[int(prob.argmax())], "model_conf": float(prob.max()),
                     "geo_hanh": types[int(hp.argmax())]["key"], "geo_conf": float(hp.max())})

    os.makedirs(a.out, exist_ok=True)
    df = pd.DataFrame(rows)
    df.drop(columns=["file"]).to_csv(os.path.join(a.out, "per_image.csv"), index=False)   # không lưu tên file ảnh
    print(f"dùng được {len(df)}/{len(files)} ảnh; loại: {skipped}")
    if df.empty: sys.exit(1)

    pd.crosstab(df.geo_hanh, df.model_label).to_csv(os.path.join(a.out, "agreement.csv"))
    print("\nBảng chéo hình học × model:\n", pd.crosstab(df.geo_hanh, df.model_label))

    conf = df[df.model_conf >= a.min_conf]
    by_key = {t["key"]: t for t in types} | {l["key"]: l for l in letters}
    sugg = {"_note": "ĐỀ XUẤT — cần người duyệt. Chỉ phần prototype hình học; nhãn yếu từ model Kaggle.",
            "_params": vars(a) | {"n_used": int(len(conf))}, "classes": {}}
    for c in classes:
        sub = conf[conf.model_label == c]
        entry = {"n": int(len(sub)),
                 "measured_z_mean": {k: round(float(sub[f"z_{k}"].mean()), 3) for k in SHAPE_DIMS} if len(sub) else None,
                 "maps_to": CLASS_MAP.get(c)}
        if len(sub) >= a.min_n:
            for role in ("hanh", "letter"):
                key = (CLASS_MAP.get(c) or {}).get(role)
                if not key or key not in by_key: continue
                old = by_key[key]["prototype"]
                new = {k: round((1 - a.blend) * old[k] + a.blend * entry["measured_z_mean"][k], 2)
                       if k in entry["measured_z_mean"] else old[k] for k in old}
                entry[f"suggest_{role}"] = {"key": key, "old": old, "new": new,
                                            "provenance": f"blend {a.blend} với trung bình z của {len(sub)} ảnh model gán '{c}' (conf>={a.min_conf})"}
        elif len(sub):
            entry["skip_reason"] = f"n < {a.min_n}"
        sugg["classes"][c] = entry
    json.dump(sugg, open(os.path.join(a.out, "prototype_suggestions.json"), "w"), ensure_ascii=False, indent=2)
    print("\nĐã ghi", os.path.join(a.out, "prototype_suggestions.json"))

if __name__ == "__main__":
    main()
