"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { uploadDocument, getDocuments, deleteDocument } from "@/lib/api";
import { FileText, Trash2, Upload, CheckCircle, Clock, Loader2, AlertCircle } from "lucide-react";
import { buttonClasses, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  pending: { icon: Clock, label: "Pendiente", className: "text-amber-700 bg-amber-50" },
  processing: { icon: Loader2, label: "Procesando", className: "text-blue-700 bg-blue-50" },
  ready: { icon: CheckCircle, label: "Listo", className: "text-emerald-700 bg-emerald-50" },
  error: { icon: AlertCircle, label: "Error", className: "text-red-700 bg-red-50" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function DocumentsClient() {
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pure fetch — no setState — so it's safe to call from the effect below.
  const fetchDocs = useCallback(async (): Promise<Document[] | null> => {
    const token = await getToken();
    if (!token) return null;
    const data = await getDocuments(token);
    return data.documents;
  }, [getToken]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const docs = await fetchDocs();
        if (active && docs) setDocuments(docs);
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Error al cargar documentos");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    // Poll every 5s to update processing status
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchDocs]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No autenticado");
      await uploadDocument(file, token);
      const docs = await fetchDocs();
      if (docs) setDocuments(docs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmDelete() {
    const doc = pendingDelete;
    setPendingDelete(null);
    if (!doc) return;
    try {
      const token = await getToken();
      if (!token) return;
      await deleteDocument(doc.id, token);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
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
            disabled={uploading}
          />
          <label
            htmlFor="file-upload"
            className={buttonClasses("primary", "md", uploading ? "opacity-60 pointer-events-none cursor-default" : "cursor-pointer")}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Subiendo..." : "Subir documento"}
          </label>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Card className="divide-y divide-gray-100">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </Card>
      ) : documents.length === 0 ? (
        <EmptyState
          className="py-20 border-2 border-dashed border-gray-200 rounded-xl"
          icon={FileText}
          title="Sin documentos todavía"
          description="Subí un PDF o TXT para empezar"
          action={
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4" />
              Subir documento
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-gray-100">
          {documents.map((doc) => {
            const { icon: StatusIcon, label, className } = statusConfig[doc.status];
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50">
                <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatBytes(doc.file_size)}
                    {doc.status === "ready" && ` · ${doc.chunk_count} chunks`}
                  </p>
                  {doc.status === "error" && doc.error_message && (
                    <p className="text-xs text-red-600 mt-1 line-clamp-1" title={doc.error_message}>
                      {doc.error_message}
                    </p>
                  )}
                </div>
                <Badge
                  icon={StatusIcon}
                  label={label}
                  className={className}
                  spin={doc.status === "processing"}
                />
                <Button
                  variant="ghostDanger"
                  size="icon"
                  onClick={() => setPendingDelete(doc)}
                  aria-label={`Eliminar ${doc.name}`}
                  title="Eliminar documento"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="¿Eliminar documento?"
        description={
          pendingDelete
            ? `Se eliminará "${pendingDelete.name}" y sus fragmentos. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
