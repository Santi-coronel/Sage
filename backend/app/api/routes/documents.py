import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.document import Document, DocumentChunk, DocumentStatus
from app.schemas.document import DocumentOut, DocumentListOut
from app.services.document_processor import extract_text, chunk_text
from app.services.embedding_service import embed_batch

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {"application/pdf", "text/plain"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


async def process_document(document_id: uuid.UUID, file_bytes: bytes, file_type: str, db: AsyncSession):
    """Background task: extract text → chunk → embed → store."""
    doc = await db.get(Document, document_id)
    if not doc:
        return

    try:
        doc.status = DocumentStatus.processing
        await db.commit()

        text = extract_text(file_bytes, file_type)
        chunks = chunk_text(text)

        if not chunks:
            raise ValueError("No text could be extracted from the document.")

        embeddings = await embed_batch(chunks)

        chunk_objects = [
            DocumentChunk(
                document_id=document_id,
                tenant_id=doc.tenant_id,
                content=chunk,
                chunk_index=i,
                embedding=embedding,
            )
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]

        db.add_all(chunk_objects)
        doc.chunk_count = len(chunks)
        doc.status = DocumentStatus.ready
        await db.commit()

    except Exception as e:
        doc.status = DocumentStatus.error
        doc.error_message = str(e)
        await db.commit()


@router.post("/", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 20 MB limit.")

    document = Document(
        tenant_id=user["org_id"],
        name=file.filename,
        file_path=f"{user['org_id']}/{uuid.uuid4()}/{file.filename}",
        file_type=file.content_type,
        file_size=len(file_bytes),
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # background task so the 202 returns immediately
    background_tasks.add_task(process_document, document.id, file_bytes, file.content_type, db)

    return document


@router.get("/", response_model=DocumentListOut)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .where(Document.tenant_id == user["org_id"])
        .order_by(Document.created_at.desc())
    )
    documents = result.scalars().all()
    return DocumentListOut(documents=list(documents), total=len(documents))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    doc = await db.get(Document, document_id)
    if not doc or doc.tenant_id != user["org_id"]:
        raise HTTPException(status_code=404, detail="Document not found.")
    await db.delete(doc)
    await db.commit()
