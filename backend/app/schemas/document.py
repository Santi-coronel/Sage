from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Optional
from app.models.document import DocumentStatus


class DocumentOut(BaseModel):
    id: UUID4
    name: str
    file_type: str
    file_size: int
    status: DocumentStatus
    chunk_count: int
    created_at: datetime
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class DocumentListOut(BaseModel):
    documents: list[DocumentOut]
    total: int
