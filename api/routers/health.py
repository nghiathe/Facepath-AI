"""GET /api/health — kiểm tra API và kết nối DB."""

from fastapi import APIRouter

from api.db.connection import get_connection
from api.rules.features import FEATURE_KEYS

router = APIRouter()


@router.get("/health")
def health() -> dict:
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM rules")
            rule_count = cur.fetchone()["n"]
        db_status, detail = "ok", None
    except Exception as exc:
        db_status, rule_count, detail = "error", None, str(exc)

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        # Số chỉ số tính từ FEATURE_KEYS, không hard-code (mục 13).
        "feature_count": len(FEATURE_KEYS),
        "rule_count": rule_count,
        "detail": detail,
    }
