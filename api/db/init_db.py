"""Tạo database và áp schema.sql.

Chạy:  python -m api.db.init_db
Chạy lại nhiều lần vẫn an toàn (mọi lệnh đều IF NOT EXISTS).
"""

from pathlib import Path

from api.config import MYSQL, enable_utf8_stdout
from api.db.connection import get_connection, server_connection

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def split_statements(sql: str) -> list[str]:
    """Tách file SQL thành từng câu lệnh, bỏ dòng comment `--`."""
    lines = [ln for ln in sql.splitlines() if not ln.strip().startswith("--")]
    return [stmt.strip() for stmt in "\n".join(lines).split(";") if stmt.strip()]


def main() -> None:
    enable_utf8_stdout()
    db_name = MYSQL["database"]

    with server_connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
    print(f"Database `{db_name}` sẵn sàng (utf8mb4).")

    statements = split_statements(SCHEMA_PATH.read_text(encoding="utf-8"))
    with get_connection() as conn, conn.cursor() as cur:
        for stmt in statements:
            cur.execute(stmt)
        cur.execute("SHOW TABLES")
        tables = sorted(next(iter(row.values())) for row in cur.fetchall())

    print(f"Đã áp {len(statements)} câu lệnh. {len(tables)} bảng trong `{db_name}`:")
    for name in tables:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
