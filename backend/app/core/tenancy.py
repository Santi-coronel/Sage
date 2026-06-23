from fastapi import Depends

from app.core.auth import get_current_user
from app.core.database import current_tenant_id


async def bind_tenant(user: dict = Depends(get_current_user)):
    """Bind the authenticated tenant to the request context.

    The "begin" listener in app.core.database reads this on each transaction and
    sets the Postgres `app.tenant_id` GUC so RLS scopes every query. Use as a
    router-level dependency on every tenant-scoped router.
    """
    token = current_tenant_id.set(user["org_id"])
    try:
        yield
    finally:
        current_tenant_id.reset(token)
