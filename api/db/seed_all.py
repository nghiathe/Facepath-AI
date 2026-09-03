"""Nạp sources / careers / rules từ /data vào MySQL.

Chạy:
    python -m api.db.seed_all --check   # chỉ soát dữ liệu, không cần MySQL
    python -m api.db.seed_all           # nạp thật

Nguồn sự thật là data/rules.json (PIPELINE mục 1). Seeder chỉ soi lại xem dữ
liệu có tự mâu thuẫn không rồi đổ vào DB; engine thật chạy ở TypeScript phía
client (web/lib/engine/).

Xoá rồi nạp lại theo đúng thứ tự khoá ngoại => chạy bao nhiêu lần cũng ra cùng
kết quả.

CITATION: cột sources.citation trong data/sources.json chỉ nói xuất xứ của cuốn
sách ("trích trong Nhân Tướng Học"), còn mỗi luật lại có citation riêng trỏ tới
đúng chương/mục ("Q.I — Ngũ hành hình tướng"). Hai thứ khác nhau, nên seeder
tạo một hàng `sources` cho từng cặp (nguồn, citation của luật) — khớp với cách
phiếu hiển thị "Ma Y Thần Tướng — Q.I, Ngũ hành hình tướng".
"""

import argparse
import json
from pathlib import Path
from typing import Any

from api.config import DATA_DIR, enable_utf8_stdout
from api.db.connection import get_connection
from api.rules.features import FEATURE_KEYS, OPS_REQUIRING


class SeedError(RuntimeError):
    """Dữ liệu trong /data không hợp lệ."""


def load(name: str) -> Any:
    path: Path = DATA_DIR / f"{name}.json"
    if not path.exists():
        raise SeedError(f"Thiếu file {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def validate_rule(rule: dict, index: int, career_slugs: set[str], source_ids: set[str]) -> None:
    """Kiểm tra một luật. Sai thì dừng hẳn với thông báo chỉ rõ chỗ sai."""
    where = f"rules.json[{index}] (id={rule.get('id')!r})"

    if not str(rule.get("id") or "").strip():
        raise SeedError(f"{where}: thiếu 'id' (khoá tự nhiên của luật).")

    key = rule.get("feature_key")
    if key not in FEATURE_KEYS:
        raise SeedError(
            f"{where}: feature_key={key!r} không nằm trong danh sách 14 chỉ số.\n"
            f"  Hợp lệ: {', '.join(FEATURE_KEYS)}\n"
            f"  (Sửa api/rules/features.py VÀ web/lib/engine/accessors.ts nếu thêm chỉ số mới.)"
        )

    op = rule.get("op")
    if op not in OPS_REQUIRING:
        raise SeedError(f"{where}: op={op!r} không hợp lệ. Hợp lệ: {', '.join(OPS_REQUIRING)}")
    for field in OPS_REQUIRING[op]:
        if rule.get(field) in (None, ""):
            raise SeedError(f"{where}: op={op!r} bắt buộc phải có {field!r}.")
    if op == "between" and rule["v_min"] >= rule["v_max"]:
        raise SeedError(f"{where}: between cần v_min < v_max.")

    for field in ("trait", "reading_hint", "source", "citation"):
        if not str(rule.get(field) or "").strip():
            raise SeedError(
                f"{where}: thiếu {field!r}. Mọi luật bắt buộc trỏ về nguồn có "
                f"trích dẫn (CLAUDE.md mục 1: kết quả phải kiểm chứng được)."
            )

    if rule["source"] not in source_ids:
        raise SeedError(
            f"{where}: source={rule['source']!r} không có trong data/sources.json.\n"
            f"  Hợp lệ: {', '.join(sorted(source_ids))}"
        )

    careers = rule.get("careers") or {}
    if not careers:
        raise SeedError(f"{where}: cần ít nhất một nhóm nghề trong 'careers'.")
    for slug, weight in careers.items():
        if slug not in career_slugs:
            raise SeedError(
                f"{where}: slug nghề {slug!r} không có trong data/careers.json.\n"
                f"  Hợp lệ: {', '.join(sorted(career_slugs))}"
            )
        if not 0 <= float(weight) <= 1:
            raise SeedError(f"{where}: trọng số của {slug!r} phải nằm trong 0..1.")

    if not 0 < float(rule.get("weight", 1.0)) <= 1:
        raise SeedError(f"{where}: 'weight' của luật phải nằm trong (0..1].")


def load_and_validate() -> dict:
    """Đọc /data và kiểm tra toàn bộ. Không đụng tới DB."""
    careers = load("careers")
    sources = load("sources")
    rules = load("rules")
    face_types = load("face_types")

    career_slugs = {c["slug"] for c in careers}
    source_ids = {s["id"] for s in sources}

    ids = [r.get("id") for r in rules]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        raise SeedError(f"rules.json có id trùng lặp: {', '.join(sorted(dup))}")

    for i, rule in enumerate(rules):
        validate_rule(rule, i, career_slugs, source_ids)

    # face_shape phải phủ đúng 5 ngũ hình trong face_types.json.
    ft_keys = {f["key"] for f in face_types}
    rule_shapes = {r["category"] for r in rules if r["feature_key"] == "face_shape"}
    if rule_shapes - ft_keys:
        raise SeedError(
            f"rules.json dùng face_shape lạ: {', '.join(sorted(rule_shapes - ft_keys))}. "
            f"face_types.json chỉ có: {', '.join(sorted(ft_keys))}"
        )

    # Nét tính cách suy thẳng từ luật (data/traits.json đã bỏ).
    traits = sorted({r["trait"] for r in rules})

    # Mỗi cặp (nguồn, trích dẫn cụ thể của luật) là một hàng sources.
    pairs = sorted({(r["source"], r["citation"]) for r in rules})
    notes = {s["id"]: s for s in sources}

    return {
        "careers": careers,
        "sources": sources,
        "rules": rules,
        "face_types": face_types,
        "traits": traits,
        "pairs": pairs,
        "notes": notes,
    }


def main(check_only: bool = False) -> None:
    enable_utf8_stdout()
    b = load_and_validate()
    careers, rules, traits, pairs, notes = (
        b["careers"], b["rules"], b["traits"], b["pairs"], b["notes"]
    )

    weight_count = sum(len(r["careers"]) for r in rules)
    summary = (
        f"sources {len(pairs)} · traits {len(traits)} · careers {len(careers)} · "
        f"rules {len(rules)} · rule_career_weights {weight_count}"
    )
    covered = {r["feature_key"] for r in rules}

    if check_only:
        print(f"Dữ liệu hợp lệ: {summary}")
        print(f"Đã phủ {len(covered)}/{len(FEATURE_KEYS)} chỉ số khuôn mặt.")
        print(f"Ngũ hình trong face_types.json: {len(b['face_types'])}")
        print("(--check: chưa ghi gì vào DB.)")
        return

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM corpus_chunks")
        if cur.fetchone()["n"]:
            raise SeedError(
                "corpus_chunks đang có dữ liệu và trỏ về sources — dừng để khỏi "
                "xoá nhầm ngữ liệu RAG. Nạp lại corpus riêng trước khi seed."
            )

        for table in ("rule_career_weights", "rules", "traits", "career_groups", "sources"):
            cur.execute(f"DELETE FROM {table}")

        cur.executemany(
            "INSERT INTO career_groups (slug, name, sample_jobs, sort_order) "
            "VALUES (%s, %s, %s, %s)",
            [(c["slug"], c["name"], c["sample_jobs"], c["sort_order"]) for c in careers],
        )
        cur.execute("SELECT id, slug FROM career_groups")
        career_id = {row["slug"]: row["id"] for row in cur.fetchall()}

        cur.executemany(
            "INSERT INTO sources (title, citation, note) VALUES (%s, %s, %s)",
            [
                (
                    notes[sid]["title"],
                    citation,
                    notes[sid].get("note") or notes[sid].get("citation"),
                )
                for sid, citation in pairs
            ],
        )
        cur.execute("SELECT id, title, citation FROM sources")
        by_title = {(row["title"], row["citation"]): row["id"] for row in cur.fetchall()}
        source_id = {
            (sid, citation): by_title[(notes[sid]["title"], citation)]
            for sid, citation in pairs
        }

        cur.executemany(
            "INSERT INTO traits (label, description) VALUES (%s, %s)",
            [(t, None) for t in traits],
        )
        cur.execute("SELECT id, label FROM traits")
        trait_id = {row["label"]: row["id"] for row in cur.fetchall()}

        weight_rows: list[tuple] = []
        for rule in rules:
            cur.execute(
                "INSERT INTO rules (rule_key, feature_key, op, v_min, v_max, category, "
                "trait_id, source_id, reading_hint, weight) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    rule["id"], rule["feature_key"], rule["op"],
                    rule.get("v_min"), rule.get("v_max"), rule.get("category"),
                    trait_id[rule["trait"]],
                    source_id[(rule["source"], rule["citation"])],
                    rule["reading_hint"], rule.get("weight", 1.0),
                ),
            )
            rid = cur.lastrowid
            weight_rows += [
                (rid, career_id[slug], float(w)) for slug, w in rule["careers"].items()
            ]

        cur.executemany(
            "INSERT INTO rule_career_weights (rule_id, career_group_id, weight) "
            "VALUES (%s, %s, %s)",
            weight_rows,
        )

    print(f"Đã seed: {summary}")
    print(f"Đã phủ {len(covered)}/{len(FEATURE_KEYS)} chỉ số khuôn mặt.")
    # face_types.json không có bảng trong CLAUDE.md mục 6; web đọc thẳng từ
    # web/lib/data.ts nên không cần nạp vào DB.
    print("face_types.json: web đọc trực tiếp, không nạp vào DB.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nạp dữ liệu tướng học vào MySQL.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Chỉ kiểm tra /data, không cần MySQL và không ghi gì vào DB.",
    )
    main(check_only=parser.parse_args().check)
