"""GET /api/rules — tra cứu luật + nguồn dẫn (mục 10)."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from api.db.connection import get_connection
from api.rules.features import FEATURE_KEYS, FEATURE_LABELS

router = APIRouter()

_SELECT = """
    SELECT r.id, r.rule_key, r.feature_key, r.op, r.v_min, r.v_max, r.category,
           r.reading_hint, r.weight,
           t.label AS trait, t.description AS trait_description,
           s.title AS source, s.citation
      FROM rules r
      JOIN traits  t ON t.id = r.trait_id
      JOIN sources s ON s.id = r.source_id
"""


@router.get("/rules")
def list_rules(
    feature: Optional[str] = Query(None, description="Lọc theo feature_key, vd brow_curvature")
) -> list[dict]:
    if feature is not None and feature not in FEATURE_KEYS:
        raise HTTPException(
            status_code=422,
            detail=f"feature_key {feature!r} không hợp lệ. Hợp lệ: {FEATURE_KEYS}",
        )

    sql, params = _SELECT, ()
    if feature:
        sql += " WHERE r.feature_key = %s"
        params = (feature,)
    sql += " ORDER BY r.feature_key, r.id"

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        rows = list(cur.fetchall())

    for row in rows:
        # Nhóm nghề mà luật này cộng điểm cho.
        row["feature_label"] = FEATURE_LABELS[row["feature_key"]]
    if not rows:
        return rows

    ids = tuple(r["id"] for r in rows)
    placeholders = ", ".join(["%s"] * len(ids))
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"SELECT w.rule_id, c.slug, c.name, w.weight "
            f"FROM rule_career_weights w "
            f"JOIN career_groups c ON c.id = w.career_group_id "
            f"WHERE w.rule_id IN ({placeholders}) ORDER BY w.weight DESC",
            ids,
        )
        by_rule: dict[int, list[dict]] = {}
        for w in cur.fetchall():
            by_rule.setdefault(w.pop("rule_id"), []).append(w)

    for row in rows:
        row["careers"] = by_rule.get(row["id"], [])
    return rows


@router.get("/features")
def list_features() -> dict:
    """Danh mục chỉ số — để UI hiển thị số lượng thay vì hard-code."""
    from api.rules.features import FEATURE_LAYERS, LIVE_FEATURE_KEYS

    return {
        "count": len(FEATURE_KEYS),
        "keys": FEATURE_KEYS,
        "layers": FEATURE_LAYERS,
        "live": LIVE_FEATURE_KEYS,
    }
