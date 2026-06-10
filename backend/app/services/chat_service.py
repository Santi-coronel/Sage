from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.config import settings
from app.models.document import DocumentChunk, Document
from app.schemas.chat import SourceCitation, ChatMessage
from app.services.embedding_service import embed_text

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based exclusively on the provided document context.

Rules:
- Answer only using the information in the provided context.
- If the context does not contain enough information to answer, say so clearly.
- Always cite which document(s) your answer comes from.
- Be concise and accurate.
- Do not make up information."""


async def retrieve_relevant_chunks(
    question: str,
    tenant_id: str,
    db: AsyncSession,
    top_k: int = None,
) -> list[tuple[DocumentChunk, Document, float]]:
    top_k = top_k or settings.top_k_results
    question_embedding = await embed_text(question)
    embedding_str = "[" + ",".join(str(v) for v in question_embedding) + "]"

    # pgvector cosine similarity search — filtered by tenant for isolation
    query = text("""
        SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
               d.name as document_name,
               1 - (dc.embedding <=> :embedding ::vector) as similarity
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.tenant_id = :tenant_id
          AND d.status = 'ready'
        ORDER BY dc.embedding <=> :embedding ::vector
        LIMIT :top_k
    """)

    result = await db.execute(query, {
        "embedding": embedding_str,
        "tenant_id": tenant_id,
        "top_k": top_k,
    })
    return result.fetchall()


async def generate_answer(
    question: str,
    chunks: list,
    conversation_history: list[ChatMessage],
) -> tuple[str, int]:
    if not chunks:
        return "I couldn't find relevant information in your documents to answer this question.", 0

    context_parts = []
    for i, row in enumerate(chunks, 1):
        context_parts.append(f"[Source {i} — {row.document_name}, chunk {row.chunk_index}]\n{row.content}")

    context = "\n\n---\n\n".join(context_parts)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in conversation_history[-6:]:  # keep last 3 exchanges for context
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({
        "role": "user",
        "content": f"Context from documents:\n\n{context}\n\nQuestion: {question}"
    })

    response = await client.chat.completions.create(
        model=settings.chat_model,
        messages=messages,
        temperature=0.1,  # low temperature for factual answers
        max_tokens=1024,
    )

    answer = response.choices[0].message.content
    tokens = response.usage.total_tokens
    return answer, tokens
