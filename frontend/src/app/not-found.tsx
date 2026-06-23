import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-6 text-center">
      <p className="text-7xl font-bold tracking-tight text-brand">404</p>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Página no encontrada</h1>
        <p className="mt-2 text-gray-500">La página que buscás no existe o fue movida.</p>
      </div>
      <Link href="/" className={buttonClasses("primary", "md")}>
        Volver al inicio
      </Link>
    </div>
  );
}
