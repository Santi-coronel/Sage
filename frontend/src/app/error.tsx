"use client";

import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-6 text-center">
      <p className="text-6xl font-bold tracking-tight text-brand">Ups</p>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Algo salió mal</h1>
        <p className="mt-2 text-gray-500">
          Ocurrió un error inesperado. Probá de nuevo en un momento.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <Link href="/" className={buttonClasses("secondary", "md")}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
