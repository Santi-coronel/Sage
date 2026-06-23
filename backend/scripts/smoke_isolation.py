#!/usr/bin/env python3
"""End-to-end tenant-isolation smoke test for Sage.

Drives the real HTTP API with TWO different tenants and asserts that tenant B
can never see tenant A's document or its contents - across the list, chat, and
delete-by-id paths. This exercises the whole stack at once: Clerk auth, the
app-level tenant filter, AND the Postgres RLS net (backend/sql/rls.sql) under it.

USAGE
    SAGE_API_URL=https://your-api     # default: http://localhost:8000
    SAGE_TOKEN_A=<JWT for tenant A>
    SAGE_TOKEN_B=<JWT for tenant B>   # MUST be a different org/user than A
    # optional: SAGE_POLL_TIMEOUT=120  (seconds to wait for embedding)

    backend/.venv/Scripts/python backend/scripts/smoke_isolation.py   # Windows
    backend/.venv/bin/python      backend/scripts/smoke_isolation.py   # *nix

GETTING TWO TOKENS (Clerk)
    Clerk's default session token expires after ~60s - too short for the
    upload+embed wait. Create a JWT template with a longer lifetime instead:

      1. Clerk Dashboard -> JWT Templates -> New template, name it "smoke_test".
           - Token lifetime: 600 seconds
           - Add claim:   org_id : {{org.id}}     (sub is included automatically)
      2. Log in to the app as account/org A. In the browser devtools console:
             await window.Clerk.session.getToken({ template: 'smoke_test' })
         Copy the JWT -> SAGE_TOKEN_A.
      3. Switch to a DIFFERENT organization (or a second account) = tenant B,
         repeat the getToken call -> SAGE_TOKEN_B.

    The backend verifies only the RS256 signature and reads sub/org_id, so a
    template token from the same Clerk instance is accepted.

Exit codes: 0 = all checks passed, 1 = a check failed, 2 = setup/config error.
"""
import os
import sys
import time
import uuid

import httpx

API = os.environ.get("SAGE_API_URL", "http://localhost:8000").rstrip("/")
TOKEN_A = os.environ.get("SAGE_TOKEN_A")
TOKEN_B = os.environ.get("SAGE_TOKEN_B")
POLL_TIMEOUT = float(os.environ.get("SAGE_POLL_TIMEOUT", "120"))

QUESTION = "What is the confidential passphrase for tenant A?"

_failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" - {detail}" if detail else ""))
    if not ok:
        _failures.append(name)
    return ok


def client(token: str) -> httpx.Client:
    return httpx.Client(
        base_url=API,
        headers={"Authorization": f"Bearer {token}"},
        timeout=90.0,
    )


def main() -> int:
    if not TOKEN_A or not TOKEN_B:
        print("ERROR: set SAGE_TOKEN_A and SAGE_TOKEN_B (two DIFFERENT tenants).\n")
        print(__doc__)
        return 2
    if TOKEN_A == TOKEN_B:
        print("ERROR: the two tokens are identical - you need two different tenants.")
        return 2

    marker = f"SAGE-RLS-SMOKE-{uuid.uuid4().hex[:12].upper()}"
    doc_text = (
        "Sage tenant-isolation smoke test document.\n\n"
        f"The confidential passphrase for tenant A is {marker}.\n\n"
        "This document belongs to tenant A only."
    ).encode("utf-8")
    doc_name = f"sage-smoke-{marker}.txt"

    a = client(TOKEN_A)
    b = client(TOKEN_B)
    doc_id = None
    try:
        print(f"API: {API}")
        print(f"Marker: {marker}\n")

        # --- preflight: both tokens valid ---
        print("Preflight")
        ra = a.get("/api/v1/documents/")
        rb = b.get("/api/v1/documents/")
        if ra.status_code == 401 or rb.status_code == 401:
            print("  [FAIL] a token was rejected (401).")
            print("  A 401 usually means the token expired (Clerk default ~60s).")
            print("  Use a JWT template with a longer lifetime - see this file's docstring.")
            return 2
        check("tenant A token accepted", ra.status_code == 200, f"HTTP {ra.status_code}")
        check("tenant B token accepted", rb.status_code == 200, f"HTTP {rb.status_code}")
        if _failures:
            return 1

        # --- tenant A uploads a document ---
        print("\nTenant A - upload")
        up = a.post("/api/v1/documents/", files={"file": (doc_name, doc_text, "text/plain")})
        if not check("upload accepted (202)", up.status_code == 202, f"HTTP {up.status_code}: {up.text[:200]}"):
            return 1
        doc_id = up.json()["id"]
        print(f"  doc_id = {doc_id}")

        # --- poll until processing finishes ---
        print("\nTenant A - wait for processing")
        status = None
        deadline = time.time() + POLL_TIMEOUT
        while time.time() < deadline:
            docs = a.get("/api/v1/documents/").json()["documents"]
            doc = next((d for d in docs if d["id"] == doc_id), None)
            status = doc["status"] if doc else None
            if status == "ready":
                break
            if status == "error":
                check("processing succeeded", False, f"status=error: {doc.get('error_message')}")
                return 1
            time.sleep(3)
        if not check("document reached 'ready'", status == "ready", f"last status={status}"):
            print("  Processing did not finish in time; raise SAGE_POLL_TIMEOUT and retry.")
            return 1

        # --- tenant A can see its own data ---
        print("\nTenant A - read paths (should see its own document)")
        docs_a = a.get("/api/v1/documents/").json()["documents"]
        check("A lists its own document", any(d["id"] == doc_id for d in docs_a))

        ca = a.post("/api/v1/chat/", json={"question": QUESTION, "conversation_history": []}).json()
        a_sources = ca.get("sources", [])
        check("A's chat cites its own document", any(s["document_id"] == doc_id for s in a_sources))
        a_has_marker = marker in ca.get("answer", "") or any(marker in s["chunk_content"] for s in a_sources)
        check("A's chat surfaces the passphrase", a_has_marker, f"answer={ca.get('answer', '')[:120]!r}")

        # --- tenant B must NOT see A's data (the isolation assertions) ---
        print("\nTenant B - isolation (must NOT see tenant A's data)")
        docs_b = b.get("/api/v1/documents/").json()["documents"]
        check("B does NOT list A's document", all(d["id"] != doc_id for d in docs_b))

        cb = b.post("/api/v1/chat/", json={"question": QUESTION, "conversation_history": []}).json()
        b_sources = cb.get("sources", [])
        check("B's chat cites NO chunk from A's document", all(s["document_id"] != doc_id for s in b_sources),
              f"{len(b_sources)} source(s)")
        leaked = marker in cb.get("answer", "") or any(marker in s.get("chunk_content", "") for s in b_sources)
        check("B's chat does NOT leak A's passphrase", not leaked)

        rdel = b.delete(f"/api/v1/documents/{doc_id}")
        check("B cannot delete A's document (404)", rdel.status_code == 404, f"HTTP {rdel.status_code}")
        survived = a.get("/api/v1/documents/").json()["documents"]
        check("A's document survived B's delete attempt", any(d["id"] == doc_id for d in survived))

    finally:
        if doc_id:
            try:
                dc = a.delete(f"/api/v1/documents/{doc_id}")
                print(f"\nCleanup: deleted A's test document (HTTP {dc.status_code})")
            except Exception as e:  # noqa: BLE001 - best-effort cleanup
                print(f"\nCleanup: could NOT delete test document {doc_id}: {e}")
        a.close()
        b.close()

    print()
    if _failures:
        print(f"RESULT: FAIL - {len(_failures)} check(s) failed: {', '.join(_failures)}")
        return 1
    print("RESULT: PASS - tenant isolation holds across list, chat, and delete-by-id.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
