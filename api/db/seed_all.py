"""Nạp careers / sources / traits / rules từ /data vào MySQL.

Chạy:  python -m api.db.seed_all

Hai nguyên tắc:
  1. CHỈ nạp luật có "verified": true. Luật chưa có trích dẫn nằm lại trong
     data/rules.json như bảng công việc để soạn dần từ sách. Nhờ vậy DB luôn
     chỉ chứa luật kiểm chứng được (CLAUDE.md mục 1).
  2. Xoá rồi nạp lại theo đúng thứ tự khoá ngoại => chạy bao nhiêu lần cũng
     ra cùng kết quả, không cần thêm unique key làm lệch DDL mục 6.

Một hàng `sources` = một cặp (title, citation). Mục 6 đặt citation trên bảng
sources, còn mục 8 cho citation theo từng luật; coi mỗi cặp là một hàng thì
khớp cả hai, khớp định dạng hiển thị "Ma Y Thần Tướng q.2", và không phải
sửa schema.
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


def validate_rule(rule: dict, index: int, career_slugs: set[str], titles: set[str]) -> None:
    """Kiểm tra một luật đã verified. Sai thì dừng hẳn với thông báo rõ ràng."""
    where = f"rules.json[{index}] (feature_key={rule.get('feature_key')!r})"

    key = rule.get("feature_key")
    if key not in FEATURE_KEYS:
        raise SeedError(
            f"{where}: feature_key không nằm trong danh sách mục 7.\n"
            f"  Hợp lệ: {', '.join(FEATURE_KEYS)}"
        )

    op = rule.get("op")
    if op not in OPS_REQUIRING:
        raise SeedError(
            f"{where}: op={op!r} không hợp lệ. "
            f"Hợp lệ: {', '.join(OPS_REQUIRING)}"
        )
    for field in OPS_REQUIRING[op]:
        if rule.get(field) in (None, ""):
            raise SeedError(f"{where}: op={op!r} bắt buộc phải có {field!r}.")
    if op == "between" and rule["v_min"] >= rule["v_max"]:
        raise SeedError(f"{where}: between cần v_min < v_max.")

    for field in ("trait", "reading_hint", "source", "citation"):
        if not str(rule.get(field) or "").strip():
            raise SeedError(
                f"{where}: thiếu {field!r}. Luật verified bắt buộc trỏ về nguồn "
                f"có trích dẫn (mục 1 CLAUDE.md)."
            )

    if rule["source"] not in titles:
        raise SeedError(
            f"{where}: source={rule['source']!r} không có trong data/sources.json. "
            f"Kiểm tra chính tả hoặc bổ sung sách vào sources.json."
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


def load_and_validate() -> dict:
    """Đọc /data và kiểm tra toàn bộ luật verified. Không đụng tới DB."""
    careers = load("careers")
    sources = load("sources")
    traits = load("traits")
    rules = load("rules")

    career_slugs = {c["slug"] for c in careers}
    source_notes = {s["title"]: s.get("note") for s in sources}

    verified = [r for r in rules if r.get("verified") is True]
    skipped = len(rules) - len(verified)
    for i, rule in enumerate(rules):
        if rule.get("verified") is True:
            validate_rule(rule, i, career_slugs, set(source_notes))

    # Nét tính cách: gộp traits.json với trait được luật nhắc tới.
    trait_desc = {t["label"]: t.get("description") for t in traits}
    for rule in verified:
        trait_desc.setdefault(rule["trait"], None)

    # Nguồn: chỉ tạo hàng cho cặp (title, citation) mà luật thật sự dùng.
    pairs = sorted({(r["source"], r["citation"]) for r in verified})

    return {
        "careers": careers, "source_notes": source_notes, "trait_desc": trait_desc,
        "verified": verified, "skipped": skipped, "pairs": pairs,
    }


def main(check_only: bool = False) -> None:
    enable_utf8_stdout()

    bundle = load_and_validate()
    careers, source_notes = bundle["careers"], bundle["source_notes"]
    trait_desc, verified = bundle["trait_desc"], bundle["verified"]
    skipped, pairs = bundle["skipped"], bundle["pairs"]

    if check_only:
        print(
            f"Dữ liệu hợp lệ: sources {len(pairs)} · traits {len(trait_desc)} · "
            f"careers {len(careers)} · rules {len(verified)} · "
            f"rule_career_weights {sum(len(r['careers']) for r in verified)}"
        )
        print(f"Bỏ qua {skipped} luật chưa có trích dẫn (verified=false).")
        covered = {r["feature_key"] for r in verified}
        print(f"Đã phủ {len(covered)}/{len(FEATURE_KEYS)} chỉ số khuôn mặt.")
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
            [(title, citation, source_notes.get(title)) for title, citation in pairs],
        )
        cur.execute("SELECT id, title, citation FROM sources")
        source_id = {(row["title"], row["citation"]): row["id"] for row in cur.fetchall()}

        cur.executemany(
            "INSERT INTO traits (label, description) VALUES (%s, %s)",
            sorted(trait_desc.items()),
        )
        cur.execute("SELECT id, label FROM traits")
        trait_id = {row["label"]: row["id"] for row in cur.fetchall()}

        weight_rows: list[tuple] = []
        for rule in verified:
            cur.execute(
                "INSERT INTO rules (feature_key, op, v_min, v_max, category, "
                "trait_id, source_id, reading_hint, weight) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    rule["feature_key"], rule["op"], rule.get("v_min"), rule.get("v_max"),
                    rule.get("category"), trait_id[rule["trait"]],
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

    print(
        f"Đã seed: sources {len(pairs)} · traits {len(trait_desc)} · "
        f"careers {len(careers)} · rules {len(verified)} · "
        f"rule_career_weights {len(weight_rows)}"
    )
    if skipped:
        print(
            f"Bỏ qua {skipped} luật chưa có trích dẫn (verified=false). "
            f"Soạn tiếp trong data/rules.json rồi chạy lại lệnh này."
        )
    covered = {r["feature_key"] for r in verified}
    print(f"Đã phủ {len(covered)}/{len(FEATURE_KEYS)} chỉ số khuôn mặt.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Chỉ kiểm tra /data, không cần MySQL và không ghi gì vào DB.",
    )
    main(check_only=parser.parse_args().check)
