"""Tải cổ thư tướng học (Hán văn gốc, public domain) từ Wikisource → data/corpus/<book>.jsonl

Chạy:  python -I data/tools/fetch_corpus.py            # tải mọi sách trong BOOKS
       python -I data/tools/fetch_corpus.py bingjian   # chỉ một sách

Chỉ dùng thư viện chuẩn. Mỗi dòng JSONL là một đoạn (passage):
  id        "<book>.<thiên>.<đoạn>" — ổn định chừng nào revid không đổi
  book, section, han, url, revid
  vi, han_viet, translator, reviewed_by — để trống, nhóm điền khi dịch/duyệt

Nếu file đã có, phần dịch (vi/han_viet/translator/reviewed_by) của các đoạn có
cùng id VÀ cùng nguyên văn được giữ lại; đoạn nào nguyên văn đổi thì bị xoá
bản dịch và in cảnh báo, để không có bản dịch nào trỏ nhầm sang câu khác.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://zh.wikisource.org/w/api.php"
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "corpus"
TRANSLATION_FIELDS = ("vi", "han_viet", "translator", "reviewed_by")

# Đoạn dài hơn ngưỡng này được cắt tiếp ở dấu "。" để mỗi đoạn vừa một ý,
# đủ ngắn cho RAG và cho việc trích dẫn trong luật.
MAX_PASSAGE = 220

GJTSJC = "欽定古今圖書集成/博物彙編/藝術典"

BOOKS = {
    "bingjian": {
        "title": "冰鑑",
        "pages": ["冰鑑"],
        "mode": "wikitext",
    },
    # 相術部 trong 古今圖書集成 — chủ yếu là 神相全編 (Viên Trung Triệt biên soạn,
    # đời Minh), kèm vài thiên khác (相兒經, 人相篇...). Danh sách quyển đọc từ trang mục lục.
    "xiangshu": {
        "title": "古今圖書集成·藝術典·相術部",
        "index": f"{GJTSJC}/相術部",
        "mode": "rendered",
    },
}


def api(**params) -> dict:
    params |= {"format": "json", "formatversion": "2"}
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Facepath-AI corpus fetcher (research)"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except OSError as e:
            if attempt == 4:
                raise
            # 429: Wikisource báo tải quá nhanh — chờ theo Retry-After nếu có.
            retry_after = getattr(e, "headers", None) and e.headers.get("Retry-After")
            wait = int(retry_after) if retry_after and retry_after.isdigit() else 15 * (attempt + 1)
            print(f"  … {e}; chờ {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def page_url(title: str, revid: int) -> str:
    return f"https://zh.wikisource.org/w/index.php?title={urllib.parse.quote(title)}&oldid={revid}"


def split_long(text: str) -> list[str]:
    """Cắt đoạn dài ở ranh giới câu; không bao giờ cắt giữa câu."""
    if len(text) <= MAX_PASSAGE:
        return [text]
    sentences = re.findall(r"[^。]+。?", text)
    out, buf = [], ""
    for s in sentences:
        if buf and len(buf) + len(s) > MAX_PASSAGE:
            out.append(buf)
            buf = ""
        buf += s
    if buf:
        out.append(buf)
    return out


def clean(text: str) -> str:
    text = text.replace("​", "").replace("　", "")
    return re.sub(r"\s+", "", text)


def sections_from_wikitext(wikitext: str) -> list[tuple[str, list[str]]]:
    """冰鑑: tiêu đề '====X====', mỗi khối cách dòng trống là một đoạn."""
    wikitext = re.sub(r"\{\{header.*?\}\}", "", wikitext, flags=re.S)
    sections: list[tuple[str, list[str]]] = []
    parts = re.split(r"^=+\s*(.+?)\s*=+\s*$", wikitext, flags=re.M)
    tail = parts[0]
    for title, body in zip(parts[1::2], parts[2::2]):
        paras = [clean(p) for p in re.split(r"\n\s*\n", body)]
        sections.append((title, [p for p in paras if p]))
    if clean(tail):
        sections.insert(0, ("序", [clean(tail)]))
    return sections


def sections_from_rendered(page_html: str) -> list[tuple[str, list[str]]]:
    """古今圖書集成: bản render; tiêu đề là dòng kết thúc bằng '[编辑]'.

    Dòng trong bản quét bị ngắt giữa câu theo khổ trang, nên ghép cả thiên lại
    rồi mới cắt theo câu. Bỏ phần điều hướng và mục lục trước dòng '藝術典第…卷'.
    """
    # Khối giấy phép cuối trang (kèm CSS) không phải nguyên văn — cắt bỏ từ đó trở đi.
    page_html = re.sub(r"<style.*?</style>", "", page_html, flags=re.S)
    page_html = re.split(r'<div[^>]*class="[^"]*licenseContainer', page_html, maxsplit=1)[0]
    text = html.unescape(re.sub(r"<[^>]+>", "", page_html))
    lines = [ln.strip() for ln in text.splitlines()]
    start = next((i for i, ln in enumerate(lines) if re.fullmatch(r"藝術典第.+卷", ln)), 0)
    sections: list[tuple[str, list[str], str | None]] = []
    title, buf = None, []
    # Tiêu đề không có thân văn là tiêu đề cấp trên (vd "神相全編三", "相兒經") —
    # giữ lại làm `part` để trích dẫn ghi đúng tên sách của từng thiên.
    part: str | None = None

    def flush():
        nonlocal part
        body = clean("".join(buf))
        if title and body:
            sections.append((title, split_long(body), part))
        elif title:
            part = title

    for ln in lines[start + 1:]:
        if ln.endswith("[编辑]"):
            flush()
            title, buf = ln.removesuffix("[编辑]").strip(), []
        elif ln:
            buf.append(ln)
    flush()
    return sections


def fetch_book(key: str, spec: dict) -> list[dict]:
    if spec["mode"] == "wikitext":
        pages = spec["pages"]
    else:
        index = api(action="parse", page=spec["index"], prop="links")["parse"]["links"]
        pages = sorted(
            {l["title"] for l in index if re.search(r"/第\d+卷$", l["title"]) and l.get("exists", True)}
        )

    passages: list[dict] = []
    sec_no = 0
    for title in pages:
        if spec["mode"] == "wikitext":
            p = api(action="parse", page=title, prop="wikitext|revid")["parse"]
            sections = [(t, ps, None) for t, ps in sections_from_wikitext(p["wikitext"])]
        else:
            p = api(action="parse", page=title, prop="text|revid")["parse"]
            sections = sections_from_rendered(p["text"])
            time.sleep(3)  # lịch sự với Wikisource — nhanh hơn là bị 429
        volume = title.rsplit("/", 1)[-1]
        for sec_title, paras, part in sections:
            sec_no += 1
            for i, han in enumerate(paras, 1):
                passages.append({
                    "id": f"{key}.{sec_no}.{i}",
                    "book": spec["title"],
                    "volume": volume if spec["mode"] == "rendered" else None,
                    "part": part,
                    "section": sec_title,
                    "han": han,
                    "url": page_url(title, p["revid"]),
                    "revid": p["revid"],
                    **{f: None for f in TRANSLATION_FIELDS},
                })
        print(f"  {title}: {len(sections)} thiên", file=sys.stderr)
    return passages


def merge_translations(new: list[dict], path: Path) -> None:
    if not path.exists():
        return
    old = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rec = json.loads(line)
            old[rec["id"]] = rec
    for rec in new:
        prev = old.get(rec["id"])
        if not prev or not any(prev.get(f) for f in TRANSLATION_FIELDS):
            continue
        if prev["han"] == rec["han"]:
            for f in TRANSLATION_FIELDS:
                rec[f] = prev.get(f)
        else:
            print(f"  ! {rec['id']}: nguyên văn đã đổi — bỏ bản dịch cũ, cần dịch lại", file=sys.stderr)


def main(argv: list[str]) -> int:
    keys = argv or list(BOOKS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for key in keys:
        if key not in BOOKS:
            print(f"Không có sách '{key}'. Có: {', '.join(BOOKS)}", file=sys.stderr)
            return 2
        print(f"[{key}] {BOOKS[key]['title']}", file=sys.stderr)
        passages = fetch_book(key, BOOKS[key])
        out = OUT_DIR / f"{key}.jsonl"
        merge_translations(passages, out)
        out.write_text(
            "".join(json.dumps(p, ensure_ascii=False) + "\n" for p in passages), encoding="utf-8"
        )
        chars = sum(len(p["han"]) for p in passages)
        print(f"  → {out.relative_to(ROOT)}: {len(passages)} đoạn, {chars} chữ", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
