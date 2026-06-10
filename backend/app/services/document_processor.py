import io
import uuid
from pathlib import Path
from typing import BinaryIO

import pypdf
from app.core.config import settings


def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def extract_text_from_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="replace")


def extract_text(file_bytes: bytes, file_type: str) -> str:
    if file_type == "application/pdf" or file_type.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    return extract_text_from_txt(file_bytes)


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    # paragraphs first — keeps semantic units intact
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current = ""

    for paragraph in paragraphs:
        if len(current) + len(paragraph) <= chunk_size:
            current += ("\n\n" if current else "") + paragraph
        else:
            if current:
                chunks.append(current)
            # paragraph too long — fall back to sentence splitting
            if len(paragraph) > chunk_size:
                sentences = paragraph.split(". ")
                current = ""
                for sentence in sentences:
                    if len(current) + len(sentence) <= chunk_size:
                        current += (". " if current else "") + sentence
                    else:
                        if current:
                            chunks.append(current)
                        current = sentence
            else:
                current = paragraph

    if current:
        chunks.append(current)

    # overlap: prepend tail of previous chunk
    if overlap > 0 and len(chunks) > 1:
        overlapped = [chunks[0]]
        for i in range(1, len(chunks)):
            tail = chunks[i - 1][-overlap:]
            overlapped.append(tail + " " + chunks[i])
        return overlapped

    return chunks
