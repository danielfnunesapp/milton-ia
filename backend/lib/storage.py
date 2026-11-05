"""Local file storage for uploads and AI-generated images (served at /api/files/{name})."""

import uuid
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def save_bytes(data: bytes, ext: str, prefix: str = "") -> str:
    name = f"{prefix}{uuid.uuid4().hex}.{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"/api/files/{name}"
