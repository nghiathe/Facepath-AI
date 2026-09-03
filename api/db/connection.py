"""Kết nối MySQL bằng PyMySQL."""

from contextlib import contextmanager
from typing import Any, Iterator

import pymysql
from pymysql.cursors import DictCursor

from api.config import MYSQL


class DbConfigError(RuntimeError):
    """Không kết nối được DB — thường do .env chưa điền hoặc MySQL chưa chạy."""


def _connect(**overrides: Any) -> pymysql.connections.Connection:
    params = {
        **MYSQL,
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": False,
        **overrides,
    }
    try:
        return pymysql.connect(**params)
    except pymysql.err.OperationalError as exc:
        raise DbConfigError(
            f"Không kết nối được MySQL tại {params['host']}:{params['port']} "
            f"(database={params.get('database')!r}, user={params['user']!r}).\n"
            f"Kiểm tra: MySQL đã chạy chưa, và .env đã điền đúng chưa "
            f"(sao chép từ .env.example).\nChi tiết: {exc}"
        ) from exc


@contextmanager
def get_connection(**overrides: Any) -> Iterator[pymysql.connections.Connection]:
    """Mở kết nối, commit nếu chạy trót lọt, rollback nếu có lỗi."""
    conn = _connect(**overrides)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def server_connection() -> Iterator[pymysql.connections.Connection]:
    """Kết nối tới server nhưng chưa chọn database — dùng để CREATE DATABASE."""
    conn = _connect(database=None, autocommit=True)
    try:
        yield conn
    finally:
        conn.close()
