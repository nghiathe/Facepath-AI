"""
Hiệu chuẩn phân phối đặc trưng cho FacePath AI.

Đầu vào: CSV mỗi dòng là MỘT lần quét (chỉ số, không ảnh), cột = tên đặc trưng
  (fh, temple, jaw, chin, length, round, jaw_angle, cheekbone_height, brow_tail_rise,
   brow_gap, eye_tilt, và mọi feature cũ: forehead_width, eye_size, brow_thickness, ...).
Có thể xuất CSV này từ chế độ "calibration" của app (người tham gia đồng ý, không lưu ảnh).

Đầu ra: calib_shape.json (mean/std robust + percentile) và báo cáo phân bố nhãn ngũ hình.

  python calibrate.py scans.csv --out ../data/calib_shape.json --types ../data/face_types.json
"""
import argparse, json, sys
import numpy as np
import pandas as pd

def robust_stats(x: pd.Series):
    x = x.dropna().astype(float)
    med = float(np.median(x))
    mad = float(np.median(np.abs(x - med))) * 1.4826          # ~std nếu phân phối chuẩn
    std = mad if mad > 1e-9 else float(x.std(ddof=1))
    q = np.percentile(x, [10, 25, 50, 75, 90]).round(4).tolist()
    return {"mean": round(med, 5), "std": round(std, 5), "n": int(len(x)),
            "p10": q[0], "p25": q[1], "p50": q[2], "p75": q[3], "p90": q[4]}

def soft_match(z: dict, protos: list, T=0.5):
    s = []
    for pr in protos:
        dims = [k for k in pr["prototype"] if k in z]
        if len(dims) < 2:
            s.append(-np.inf); continue
        s.append(-np.mean([(np.clip(z[k], -3, 3) - pr["prototype"][k]) ** 2 for k in dims]))
    s = np.array(s); e = np.exp((s - s.max()) / T); e /= e.sum()
    return e

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv"); ap.add_argument("--out", required=True); ap.add_argument("--types")
    ap.add_argument("--min-n", type=int, default=150)
    a = ap.parse_args()
    df = pd.read_csv(a.csv)
    if len(df) < a.min_n:
        print(f"CẢNH BÁO: chỉ có {len(df)} mẫu (< {a.min_n}); std sẽ không ổn định.", file=sys.stderr)
    calib = {"_status": f"calibrated from {a.csv}, n={len(df)}"}
    for c in df.columns:
        if pd.api.types.is_numeric_dtype(df[c]):
            calib[c] = robust_stats(df[c])
    json.dump(calib, open(a.out, "w"), ensure_ascii=False, indent=2)
    print("đã ghi", a.out)

    if a.types:
        protos = json.load(open(a.types))
        keys = [p["key"] for p in protos]
        top = []
        for _, row in df.iterrows():
            z = {k: (row[k] - calib[k]["mean"]) / calib[k]["std"] for k in calib if k != "_status" and pd.notna(row.get(k))}
            top.append(keys[int(np.argmax(soft_match(z, protos)))])
        dist = pd.Series(top).value_counts(normalize=True).round(3)
        print("\nPhân bố nhãn ngũ hình sau hiệu chuẩn:\n", dist.to_string())
        if dist.max() > 0.40:
            print(f"\n⚠ Nhãn '{dist.idxmax()}' chiếm {dist.max():.0%} — xem lại prototype hoặc chất lượng ảnh.")

if __name__ == "__main__":
    main()
