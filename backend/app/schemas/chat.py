from pydantic import BaseModel, UUID4
from typing import Optional


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    conversation_history: list[ChatMessage] = []


class SourceCitation(BaseModel):
    document_id: UUID4
    document_name: str
    chunk_content: str
    chunk_index: int
    similarity_score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    tokens_used: Optional[int] = None
