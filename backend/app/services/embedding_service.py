from openai import AsyncOpenAI
from app.core.config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)


async def embed_text(text: str) -> list[float]:
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one API call — cheaper and faster."""
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=texts,
    )
    # API returns embeddings in the same order as input
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
