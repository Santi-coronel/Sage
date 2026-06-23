#!/usr/bin/env python3
"""Database-level verification of Sage's Row-Level Security net (rls.sql).

Unlike smoke_isolation.py (which drives the HTTP API and exercises auth + the
app filter + RLS together), this script connects straight to Postgres and sets
the `app.tenant_id` GUC by hand. It therefore proves the RLS layer ON ITS OWN:
that the policies filter correctly AND that the app's DB role does not bypass RLS.

It writes two throwaway rows under synthetic tenant ids and deletes them again.

USAGE
    # DATABASE_URL is read from the env, or falls back to backend/.env
    backend/.venv/Scripts/python backend/scripts/verify_rls.py     # Windows
    backend/.venv/bin/python      backend/scripts/verify_rls.py     # *nix

Exit codes: 0 = RLS verified, 1 = a check failed, 2 = setup/config error.
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path

import asyncpg

_failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" - {detail}" if detail else ""))
    if not ok:
        _failures.append(name)
    return ok


def resolve_dsn() -> str | None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    dsn = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not dsn:
        return None
    # asyncpg wants a plain libpq URL, not SQLAlchemy's +asyncpg form
    return dsn.replace("+asyncpg", "")


async def set_tenant(conn: asyncpg.Connection, tenant: str) -> None:
    # transaction-local: caller MUST be inside an explicit transaction
    await conn.execute("SELECT set_config('app.tenant_id', $1, true)", tenant)


async def count_doc(conn: asyncpg.Connection, doc_id) -> int:
    return await conn.fetchval("SELECT count(*) FROM documents WHERE id = $1", doc_id)


async def count_chunk(conn: asyncpg.Connection, chunk_id) -> int:
    return await conn.fetchval("SELECT count(*) FROM document_chunks WHERE id = $1", chunk_id)


async def run(conn: asyncpg.Connection) -> None:
    suffix = uuid.uuid4().hex[:8]
    TENANT_A = f"__rls_verify_A__{suffix}"
    TENANT_B = f"__rls_verify_B__{suffix}"
    doc_id = chunk_id = None

    try:
        # --- role privileges: RLS is silently bypassed by SUPERUSER / BYPASSRLS ---
        print("Connection role")
        row = await conn.fetchrow(
            "SELECT current_user AS u, rolsuper, rolbypassrls "
            "FROM pg_roles WHERE rolname = current_user"
        )
        print(f"  role={row['u']}  rolsuper={row['rolsuper']}  rolbypassrls={row['rolbypassrls']}")
        check("role is not SUPERUSER", not row["rolsuper"])
        check("role does not have BYPASSRLS", not row["rolbypassrls"])
        if row["rolsuper"] or row["rolbypassrls"]:
            print("  ^ This role bypasses RLS - the isolation checks below WILL fail.")
            print("    Connect as a NOSUPERUSER / NOBYPASSRLS role (see rls.sql).")

        # --- seed: tenant A inserts a document + a chunk (also tests WITH CHECK ok) ---
        print("\nSeed (as tenant A)")
        async with conn.transaction():
            await set_tenant(conn, TENANT_A)
            doc_id = await conn.fetchval(
                "INSERT INTO documents (tenant_id, name, file_path, file_type, file_size) "
                "VALUES ($1, $2, $3, $4, $5) RETURNING id",
                TENANT_A, "rls-verify.txt", f"{TENANT_A}/rls-verify.txt", "text/plain", 1,
            )
            chunk_id = await conn.fetchval(
                "INSERT INTO document_chunks (document_id, tenant_id, content, chunk_index) "
                "VALUES ($1, $2, $3, $4) RETURNING id",
                doc_id, TENANT_A, "secret content for tenant A", 0,
            )
        check("tenant A can INSERT its own rows (WITH CHECK allows match)",
              doc_id is not None and chunk_id is not None)

        # --- tenant A can read its own rows ---
        print("\nRead as tenant A (should see its rows)")
        async with conn.transaction():
            await set_tenant(conn, TENANT_A)
            da = await count_doc(conn, doc_id)
            ka = await count_chunk(conn, chunk_id)
        check("A sees its own document", da == 1, f"count={da}")
        check("A sees its own chunk", ka == 1, f"count={ka}")

        # --- tenant B must NOT read tenant A's rows (the core RLS assertion) ---
        print("\nRead as tenant B (must see NOTHING of A)")
        async with conn.transaction():
            await set_tenant(conn, TENANT_B)
            db = await count_doc(conn, doc_id)
            kb = await count_chunk(conn, chunk_id)
        check("B cannot see A's document", db == 0, f"count={db}")
        check("B cannot see A's chunk", kb == 0, f"count={kb}")

        # --- no tenant bound => fail closed ---
        print("\nRead with NO tenant bound (must fail closed)")
        async with conn.transaction():
            dn = await count_doc(conn, doc_id)
        check("unset app.tenant_id sees no rows", dn == 0, f"count={dn}")

        # --- WITH CHECK blocks writing into another tenant ---
        print("\nWrite as tenant B into tenant A (must be rejected)")
        rejected = False
        try:
            async with conn.transaction():
                await set_tenant(conn, TENANT_B)
                await conn.execute(
                    "INSERT INTO documents (tenant_id, name, file_path, file_type, file_size) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    TENANT_A, "evil.txt", "evil/evil.txt", "text/plain", 1,
                )
        except asyncpg.PostgresError as e:
            rejected = True
            print(f"  (rejected: {type(e).__name__})")
        check("B cannot INSERT a row owned by A (WITH CHECK)", rejected)

    finally:
        # best-effort cleanup of the throwaway rows
        print("\nCleanup")
        for tenant in (TENANT_A, TENANT_B):
            try:
                async with conn.transaction():
                    await set_tenant(conn, tenant)
                    await conn.execute("DELETE FROM document_chunks WHERE tenant_id = $1", tenant)
                    await conn.execute("DELETE FROM documents WHERE tenant_id = $1", tenant)
            except Exception as e:  # noqa: BLE001 - best effort
                print(f"  could not clean tenant {tenant}: {e}")
        print("  done")


async def main() -> int:
    dsn = resolve_dsn()
    if not dsn:
        print("ERROR: DATABASE_URL not set and not found in backend/.env")
        return 2
    try:
        # statement_cache_size=0 keeps this safe behind the Supabase pgbouncer pooler
        conn = await asyncpg.connect(dsn, statement_cache_size=0)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: could not connect to the database: {e}")
        return 2
    try:
        await run(conn)
    finally:
        await conn.close()

    print()
    if _failures:
        print(f"RESULT: FAIL - {len(_failures)} check(s) failed: {', '.join(_failures)}")
        print("If isolation checks failed, confirm rls.sql ran and the role does not bypass RLS.")
        return 1
    print("RESULT: PASS - RLS enforces tenant isolation at the database layer.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
