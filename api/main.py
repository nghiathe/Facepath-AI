"""FastAPI app cho Facepath-AI.

Chạy:  uvicorn api.main:app --reload --port 8000

BẤT BIẾN (CLAUDE.md mục 1 + 13): không endpoint nào nhận ảnh hay khung hình.
Server chỉ nhận vector số. Nếu một tính năng cần ảnh ở server — dừng lại và hỏi.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import WEB_ORIGIN
from api.routers import careers, health, rules

app = FastAPI(
    title="Facepath-AI API",
    description=(
        "Bộ luật tướng học số hoá. Kết quả chỉ để tham khảo/giải trí, "
        "không dùng cho tuyển dụng, xét học bổng hay đánh giá năng lực."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEB_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

for module in (health, careers, rules):
    app.include_router(module.router, prefix="/api", tags=["facepath"])
