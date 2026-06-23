from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.tenancy import bind_tenant
from app.schemas.chat import ChatRequest, ChatResponse, SourceCitation
from app.services.chat_service import retrieve_relevant_chunks, generate_answer

router = APIRouter(prefix="/chat", tags=["chat"], dependencies=[Depends(bind_tenant)])


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    chunks = await retrieve_relevant_chunks(
        question=request.question,
        tenant_id=user["org_id"],
        db=db,
    )

    answer, tokens_used = await generate_answer(
        question=request.question,
        chunks=chunks,
        conversation_history=request.conversation_history,
    )

    sources = [
        SourceCitation(
            document_id=row.document_id,
            document_name=row.document_name,
            chunk_content=row.content[:300],  # truncate for response size
            chunk_index=row.chunk_index,
            similarity_score=round(float(row.similarity), 4),
        )
        for row in chunks
        if row.similarity > 0.3  # filter low-relevance chunks
    ]

    return ChatResponse(answer=answer, sources=sources, tokens_used=tokens_used)
