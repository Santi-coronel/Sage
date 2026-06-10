import base64
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from app.core.config import settings

security = HTTPBearer()


def _clerk_jwks_url(publishable_key: str) -> str:
    # pk_test_<base64url-encoded-domain$> → decode → domain
    key_part = publishable_key.split("_", 2)[2]
    padding = (4 - len(key_part) % 4) % 4
    domain = base64.b64decode(key_part + "=" * padding).decode("utf-8").rstrip("$")
    return f"https://{domain}/.well-known/jwks.json"


jwks_client = PyJWKClient(_clerk_jwks_url(settings.clerk_publishable_key))


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub")
        org_id: str = payload.get("org_id")  # Clerk org for multi-tenant isolation
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"user_id": user_id, "org_id": org_id or user_id}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
