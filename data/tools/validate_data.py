"""Kiểm định bộ dữ liệu trước khi seed / build — thoát khác 0 nếu có lỗi.

Chạy:  python -I data/tools/validate_data.py          # báo cáo đầy đủ
       python -I data/tools/validate_data.py --brief  # chỉ đếm lỗi theo nhóm

Kiểm những ràng buộc của bản thương mại (xem kế hoạch "chỉ dùng nguồn công cộng"):
  1. Nguồn: không nguồn nào trỏ về Nhân Tướng Học (Hy Trương) hay "trích trong" sách đó.
  2. Luật: có passage_ids trỏ vào data/corpus; quote_han nằm nguyên văn trong các đoạn
     đó; confidence ∈ {sach, suy_luan}; có reading_short + reading_full; trait_dims hợp lệ;
     feature_key có hàm đo (web/lib/features/catalog.ts); không thuộc chủ đề bị loại.
  3. Hiển thị: mọi trường người dùng nhìn thấy (trait, luận giải, quote_vi, citation,
     tên nguồn, ngũ hình, nghề) phải là tiếng Việt — không chứa chữ Hán. Nguyên văn Hán
     (quote_han, corpus.han) chỉ để kiểm chứng nội bộ, không bao giờ hiển thị.
  4. Nghề: careers.json + occupations.json — mỗi nghề có mã VSCO, mã O*NET và đủ
     vector work-style; nhóm nào cũng có ≥ MIN_OCCUPATIONS nghề.
Chỉ dùng thư viện chuẩn.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRAIN = ROOT / "data" / "data-train"
CORPUS = ROOT / "data" / "corpus"
CATALOG_TS = ROOT / "web" / "lib" / "features" / "catalog.ts"

MIN_RULES = 80
MIN_OCCUPATIONS = 15
CONFIDENCE = {"sach", "suy_luan"}

# Bản thương mại chỉ nói tính cách & nghề. Luật chạm tới các chủ đề này là "xem bói",
# không phải mô tả tính cách — loại (kế hoạch, giai đoạn 2.4).
BANNED_TOPICS = [
    "phú quý", "bần tiện", "giàu sang", "nghèo hèn", "hiển đạt", "phúc khí",
    "thọ", "yểu", "chết", "bệnh", "tai hoạ", "tai họa",
    "hôn nhân", "vợ", "chồng", "con cái", "khắc", "sát phu", "sát thê",
]
# Trường người dùng nhìn thấy — không được có chữ Hán (chỉ hiển thị tiếng Việt).
RULE_DISPLAY = ("trait", "reading_hint", "reading_short", "reading_full", "quote_vi", "citation")
SOURCE_DISPLAY = ("title", "author", "citation", "note")
FACE_DISPLAY = ("label", "trigger", "duc_tinh", "summary", "reading", "citation", "reading_full")
CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\U00020000-\U0002ffff]")


def check_vietnamese(where: str, obj: dict, fields, rep: "Report") -> None:
    for f in fields:
        val = obj.get(f)
        texts = val if isinstance(val, list) else [val]
        for t in texts:
            if isinstance(t, str) and CJK.search(t):
                rep.err("hiển thị · chữ Hán", f"{where}.{f}: {CJK.findall(t)[:6]} — chỉ được hiển thị tiếng Việt")


BANNED_SOURCE_MARKERS = ["nhân tướng học", "hy trương", "trích trong"]


class Report:
    def __init__(self) -> None:
        self.errors: dict[str, list[str]] = defaultdict(list)

    def err(self, group: str, msg: str) -> None:
        self.errors[group].append(msg)

    def print(self, brief: bool) -> int:
        total = sum(len(v) for v in self.errors.values())
        for group, msgs in self.errors.items():
            print(f"\n[{group}] {len(msgs)} lỗi")
            if not brief:
                for m in msgs:
                    print(f"  - {m}")
        print(f"\nTổng: {total} lỗi" if total else "\nDữ liệu hợp lệ.")
        return 1 if total else 0


def load_json(path: Path, rep: Report, group: str):
    if not path.exists():
        rep.err(group, f"thiếu file {path.relative_to(ROOT)}")
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_corpus(rep: Report) -> dict[str, dict]:
    corpus: dict[str, dict] = {}
    files = sorted(CORPUS.glob("*.jsonl"))
    if not files:
        rep.err("ngữ liệu", "data/corpus/ chưa có file .jsonl nào — chạy data/tools/fetch_corpus.py")
    for f in files:
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            rec = json.loads(line)
            if rec["id"] in corpus:
                rep.err("ngữ liệu", f"{f.name}:{n} trùng id {rec['id']}")
            for field in ("han", "url", "revid"):
                if not rec.get(field):
                    rep.err("ngữ liệu", f"{f.name}:{n} ({rec['id']}) thiếu {field}")
            if rec.get("vi") and not rec.get("translator"):
                rep.err("ngữ liệu", f"{rec['id']}: có bản dịch nhưng không ghi translator")
            corpus[rec["id"]] = rec
    return corpus


def measured_keys() -> set[str]:
    text = CATALOG_TS.read_text(encoding="utf-8")
    block = text.split("FEATURE_LAYERS", 1)[1].split("];", 1)[0]
    return set(re.findall(r"^\s+(\w+):\s*\"", block, flags=re.M))


def check_sources(sources: list[dict], rep: Report) -> set[str]:
    ids = set()
    for s in sources:
        ids.add(s["id"])
        if s.get("type") == "model":
            continue
        check_vietnamese(f"sources[{s['id']}]", s, SOURCE_DISPLAY, rep)
        blob = " ".join(str(s.get(k, "")) for k in ("title", "author", "citation", "note")).lower()
        if any(m in blob for m in BANNED_SOURCE_MARKERS):
            rep.err("nguồn", f"{s['id']} ({s['title']}): trỏ về Nhân Tướng Học / bản trích — cần nguồn Hán văn gốc")
        if not s.get("url"):
            rep.err("nguồn", f"{s['id']} ({s['title']}): thiếu url bản Hán văn công cộng")
    return ids


def check_rules(rules, corpus, source_ids, trait_dims, rep: Report) -> None:
    keys = measured_keys()
    if len(rules) < MIN_RULES:
        rep.err("luật", f"mới có {len(rules)} luật, mục tiêu ≥ {MIN_RULES}")
    seen = set()
    for r in rules:
        rid = r.get("id", "?")
        if rid in seen:
            rep.err("luật", f"{rid}: trùng id")
        seen.add(rid)

        if r.get("source") not in source_ids:
            rep.err("luật · nguồn", f"{rid}: source '{r.get('source')}' không có trong sources.json")

        pids = r.get("passage_ids") or []
        if not pids:
            rep.err("luật · trích dẫn", f"{rid}: chưa có passage_ids")
        missing = [p for p in pids if p not in corpus]
        if missing:
            rep.err("luật · trích dẫn", f"{rid}: passage_ids không tồn tại {missing}")
        # quote_han: một câu, hoặc danh sách câu khi luật dựa trên nhiều đoạn.
        quote = r.get("quote_han")
        quotes = quote if isinstance(quote, list) else [quote] if quote else []
        if pids and not missing:
            pool = [corpus[p]["han"] for p in pids]
            if not quotes:
                rep.err("luật · trích dẫn", f"{rid}: thiếu quote_han")
            for q in quotes:
                if not any(q in h for h in pool):
                    rep.err("luật · trích dẫn", f"{rid}: quote_han '{q[:20]}…' không khớp nguyên văn trong {pids}")
            for p in pids:
                if not corpus[p].get("vi"):
                    rep.err("luật · trích dẫn", f"{rid}: đoạn {p} chưa có bản dịch tiếng Việt")
        if quotes and not r.get("quote_vi"):
            rep.err("luật · trích dẫn", f"{rid}: có quote_han nhưng thiếu quote_vi")
        check_vietnamese(f"rules[{rid}]", r, RULE_DISPLAY, rep)

        if r.get("confidence") not in CONFIDENCE:
            rep.err("luật · nội dung", f"{rid}: confidence phải là sach | suy_luan")
        for field in ("reading_short", "reading_full"):
            if not r.get(field):
                rep.err("luật · nội dung", f"{rid}: thiếu {field}")

        dims = r.get("trait_dims")
        if not dims:
            rep.err("luật · nghề", f"{rid}: chưa có trait_dims")
        elif trait_dims is not None:
            bad = [d for d in dims if d not in trait_dims]
            if bad:
                rep.err("luật · nghề", f"{rid}: trait_dims lạ {bad}")

        for key in [c["feature_key"] for c in r.get("conditions", [])] or [r.get("feature_key")]:
            if key not in keys:
                rep.err("luật · đo đạc", f"{rid}: feature_key '{key}' chưa có hàm đo trong catalog.ts")

        text = " ".join(str(r.get(k, "")) for k in ("trait", "reading_hint", "reading_short", "reading_full")).lower()
        hits = [t for t in BANNED_TOPICS if re.search(rf"(?<!\w){re.escape(t)}(?!\w)", text)]
        if hits:
            rep.err("luật · chủ đề bị loại", f"{rid}: nhắc tới {hits}")


def check_careers(rep: Report, trait_dims) -> None:
    groups = load_json(TRAIN / "careers.json", rep, "nghề")
    occs = load_json(TRAIN / "occupations.json", rep, "nghề")
    if groups is None or occs is None:
        return
    slugs = {g["slug"] for g in groups}
    per_group: dict[str, int] = defaultdict(int)
    for o in occs:
        name = o.get("name", "?")
        if o.get("group") not in slugs:
            rep.err("nghề", f"{name}: group '{o.get('group')}' không có trong careers.json")
        per_group[o.get("group")] += 1
        check_vietnamese(f"occupations[{name}]", o, ("name", "description", "skills", "majors"), rep)
        for field in ("vsco_code", "onet_code", "description"):
            if not o.get(field):
                rep.err("nghề", f"{name}: thiếu {field}")
        ws = o.get("work_styles") or {}
        if trait_dims is not None and set(ws) != set(trait_dims):
            rep.err("nghề", f"{name}: work_styles thiếu {sorted(set(trait_dims) - set(ws))}")
    for g in groups:
        if per_group[g["slug"]] < MIN_OCCUPATIONS:
            rep.err("nghề", f"nhóm {g['slug']}: {per_group[g['slug']]} nghề, cần ≥ {MIN_OCCUPATIONS}")


def main(argv: list[str]) -> int:
    rep = Report()
    corpus = load_corpus(rep)
    sources = load_json(TRAIN / "sources.json", rep, "nguồn") or []
    rules = load_json(TRAIN / "rules.json", rep, "luật") or []
    dims_doc = load_json(TRAIN / "trait_dims.json", rep, "luật · nghề")
    trait_dims = {d["id"] for d in dims_doc} if dims_doc else None

    source_ids = check_sources(sources, rep)
    for ft in load_json(TRAIN / "face_types.json", rep, "ngũ hình") or []:
        check_vietnamese(f"face_types[{ft['key']}]", ft, FACE_DISPLAY, rep)
        if ft.get("source") not in source_ids:
            rep.err("ngũ hình", f"{ft['key']}: source '{ft.get('source')}' không có trong sources.json")
        for p in ft.get("passage_ids") or []:
            if p not in corpus:
                rep.err("ngũ hình", f"{ft['key']}: passage_id {p} không tồn tại")
        if not ft.get("passage_ids"):
            rep.err("ngũ hình", f"{ft['key']}: chưa có passage_ids")
    for pid, rec in corpus.items():
        check_vietnamese(f"corpus[{pid}]", rec, ("vi",), rep)
    check_rules(rules, corpus, source_ids, trait_dims, rep)
    check_careers(rep, trait_dims)

    print(f"Ngữ liệu: {len(corpus)} đoạn · Nguồn: {len(sources)} · Luật: {len(rules)}")
    return rep.print(brief="--brief" in argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
