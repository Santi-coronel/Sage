const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Clerk token injected from the client — see useAuth()
  // This helper is used inside fetch calls that pass the token explicitly.
  return { "Content-Type": "application/json" };
}

export async function fetchWithAuth(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function uploadDocument(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/documents/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getDocuments(token: string) {
  return fetchWithAuth("/api/v1/documents/", token);
}

export async function deleteDocument(id: string, token: string) {
  await fetchWithAuth(`/api/v1/documents/${id}`, token, { method: "DELETE" });
}

export async function sendChatMessage(
  question: string,
  conversationHistory: { role: string; content: string }[],
  token: string,
) {
  return fetchWithAuth("/api/v1/chat/", token, {
    method: "POST",
    body: JSON.stringify({ question, conversation_history: conversationHistory }),
  });
}
