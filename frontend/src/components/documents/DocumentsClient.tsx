"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { uploadDocument, getDocuments, deleteDocument } from "@/lib/api";
import { FileText, Trash2, Upload, AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";

type DocumentStatus = "pending" | "processing" | "ready" | "error";

interface Document {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  chunk_count: number;
  created_at: string;
  error_message?: string;
}

const statusConfig: Record<DocumentStatus, { icon: React.ElementType; label: string; className: string }> = {
  pending: { icon: Clock, label: "Pendiente", className: "text-amber-600 bg-amber-50" },
  processing: { icon: Loader2, label: "Procesando", className: "text-blue-600 bg-blue-50" },
  ready: { icon: CheckCircle, label: "Listo", className: "text-emerald-600 bg-emerald-50" },
  error: { icon: AlertCircle, label: "Error", className: "text-red-600 bg-red-50" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function DocumentsClient() {
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getDocuments(token);
      setDocuments(data.documents);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar documentos");
    }
  }, [getToken]);

  useEffect(() => {
    loadDocuments();
    // Poll every 5s to update processing status
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [loadDocuments]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");
      await uploadDocument(file, token);
      await loadDocuments();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")) return;
    try {
      const token = await getToken();
      if (!token) return;
      await deleteDocument(id, token);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-gray-500 mt-1">Subí tus documentos para empezar a hacer preguntas.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer font-medium text-sm transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Subiendo..." : "Subir documento"}
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <FileText className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Sin documentos todavía</p>
          <p className="text-gray-400 text-sm mt-1">Subí un PDF o TXT para empezar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {documents.map((doc) => {
            const { icon: StatusIcon, label, className } = statusConfig[doc.status];
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4">
                <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {formatBytes(doc.file_size)}
                    {doc.status === "ready" && ` · ${doc.chunk_count} chunks`}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
                  <StatusIcon className={`w-3.5 h-3.5 ${doc.status === "processing" ? "animate-spin" : ""}`} />
                  {label}
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  title="Eliminar documento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
