"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { sendChatMessage } from "@/lib/api";
import { Send, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

interface Source {
  document_id: string;
  document_name: string;
  chunk_content: string;
  chunk_index: number;
  similarity_score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function ChatClient() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");

      const history = messages.map(({ role, content }) => ({ role, content }));
      const data = await sendChatMessage(question, history, token);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
        <p className="text-gray-500 mt-1">Hacé preguntas sobre tus documentos.</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        {messages.length === 0 && !loading && (
          <EmptyState
            className="h-full"
            icon={BookOpen}
            title="Todavía no hay conversación"
            description="Escribí una pregunta sobre tus documentos abajo."
          />
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex animate-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-brand text-white rounded-br-sm"
                  : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_strong]:font-semibold [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_a]:text-brand [&_a]:underline">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Fuentes
                  </p>
                  {msg.sources.map((src, j) => (
                    <div key={j} className="text-xs bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <p className="font-medium text-brand">{src.document_name}</p>
                      <p className="text-gray-600 mt-1 line-clamp-2">{src.chunk_content}</p>
                      <p className="text-gray-500 mt-1">
                        {Math.round(src.similarity_score * 100)}% de coincidencia
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-in">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="flex gap-1" role="status" aria-label="Pensando">
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <ErrorBanner message={error} className="mt-3" />}

      <form onSubmit={handleSubmit} className="flex gap-3 mt-4">
        <label htmlFor="chat-input" className="sr-only">
          Pregunta
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí una pregunta sobre tus documentos..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          disabled={loading}
        />
        <Button
          type="submit"
          size="icon"
          loading={loading}
          disabled={!input.trim()}
          aria-label="Enviar pregunta"
        >
          {!loading && <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
