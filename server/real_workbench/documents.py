from __future__ import annotations

import hashlib
import io
import re
from pathlib import Path

from pypdf import PdfReader


DOI_PATTERN = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.I)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_doi(value: str) -> str:
    normalized = value.strip()
    normalized = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", normalized, flags=re.I)
    normalized = re.sub(r"^doi:\s*", "", normalized, flags=re.I)
    normalized = normalized.rstrip(".,;:)]}\"'").lower()
    if not re.fullmatch(r"10\.\d{4,9}/\S+", normalized, flags=re.I):
        raise ValueError("DOI格式无效")
    return normalized


def extract_doi_candidates(text: str) -> list[str]:
    values: list[str] = []
    for match in DOI_PATTERN.findall(text):
        try:
            value = normalize_doi(match)
        except ValueError:
            continue
        if value not in values:
            values.append(value)
    return values


def extract_pdf_text(path: Path, max_pages: int = 5) -> str:
    try:
        reader = PdfReader(str(path))
        return "\n".join((page.extract_text() or "") for page in reader.pages[:max_pages])
    except Exception:
        return path.read_bytes()[:2_000_000].decode("latin-1", errors="ignore")


def doi_candidates_from_bytes(data: bytes) -> list[str]:
    try:
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages[:5])
    except Exception:
        text = data[:2_000_000].decode("latin-1", errors="ignore")
    return extract_doi_candidates(text)


def safe_filename(name: str) -> str:
    cleaned = re.sub(r"[\\/\x00-\x1f]+", "_", Path(name).name).strip()
    if not cleaned.lower().endswith(".pdf"):
        raise ValueError("只允许PDF文件")
    return cleaned or "paper.pdf"


def validate_pdf_bytes(data: bytes, max_bytes: int) -> None:
    if len(data) > max_bytes:
        raise ValueError("PDF超过大小限制")
    if not data.startswith(b"%PDF-"):
        raise ValueError("文件内容不是有效PDF")
