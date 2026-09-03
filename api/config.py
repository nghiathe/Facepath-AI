"""Cấu hình đọc từ .env (CLAUDE.md mục 13: bí mật qua biến môi trường, không commit)."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

load_dotenv(REPO_ROOT / ".env")


def enable_utf8_stdout() -> None:
    """Bật UTF-8 cho stdout.

    Console Windows mặc định dùng codepage cp1258, in tiếng Việt có dấu sẽ
    ném UnicodeEncodeError. Mọi script chạy bằng tay (init_db, seed_all) gọi
    hàm này trước khi in.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass


MYSQL = {
    "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "facepath"),
}

WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000")
