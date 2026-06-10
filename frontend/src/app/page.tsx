import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/documents");

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-6xl font-bold text-white tracking-tight">Sage</h1>
        <p className="text-xl text-slate-300 leading-relaxed">
          Tu asistente de IA privado, entrenado con tus propios documentos.
          Subí PDFs y archivos de texto, hacé preguntas — Sage responde con citas.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
          >
            Empezar gratis
          </Link>
          <Link
            href="/sign-in"
            className="px-8 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold rounded-lg transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
