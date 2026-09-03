"""GET /api/careers — 6 nhóm nghề cho trang "Kho luận giải" (mục 10)."""

from fastapi import APIRouter

from api.db.connection import get_connection

router = APIRouter()


@router.get("/careers")
def list_careers() -> list[dict]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT slug, name, sample_jobs FROM career_groups "
            "ORDER BY sort_order, id"
        )
        return list(cur.fetchall())
