from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Sage API"
    debug: bool = False

    database_url: str
    openai_api_key: str

    # Clerk JWT verification
    clerk_secret_key: str
    clerk_publishable_key: str

    # Supabase (optional — MVP uses direct DB connection, not Supabase client)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Embedding model
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # Chat model
    chat_model: str = "gpt-4o-mini"

    # RAG settings
    chunk_size: int = 800
    chunk_overlap: int = 100
    top_k_results: int = 5

    class Config:
        env_file = ".env"


settings = Settings()
