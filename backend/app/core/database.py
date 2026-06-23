from contextvars import ContextVar

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Tenant bound to the current request/task (set by app.core.tenancy.bind_tenant
# for requests, and by the document background task). The "begin" listener below
# reads it to scope every DB transaction via Postgres RLS.
current_tenant_id: ContextVar[str | None] = ContextVar("current_tenant_id", default=None)

db_url = (
    settings.database_url
    .replace("postgresql://", "postgresql+asyncpg://")
    .replace("postgres://", "postgresql+asyncpg://")
)

# statement_cache_size=0 disables asyncpg's prepared-statement cache, which is
# required behind the Supabase transaction pooler (:6543, recommended in
# .env.example): a pooled connection may land on a different backend between
# transactions, so cached prepared statements break with "prepared statement
# does not exist". This also keeps the engine consistent with scripts/verify_rls.py.
engine = create_async_engine(
    db_url,
    echo=settings.debug,
    connect_args={"statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "begin")
def _bind_tenant_for_rls(conn):
    """At the start of every transaction, set the transaction-local
    `app.tenant_id` GUC so Postgres RLS scopes all queries to the current tenant.
    No-op when no tenant is bound (e.g. health checks). Transaction-local
    (set_config(..., true)) keeps it correct under the Supabase pooler, where
    each transaction may land on a different backend."""
    tenant_id = current_tenant_id.get()
    if tenant_id is not None:
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": tenant_id},
        )


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
