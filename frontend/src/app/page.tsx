import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FileSearch, ShieldCheck, Zap } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

const features = [
  {
    icon: FileSearch,
    title: "Citas a la fuente exacta",
    description:
      "Cada respuesta indica de qué documento y qué fragmento salió, con su puntaje de coincidencia.",
  },
  {
    icon: ShieldCheck,
    title: "Privado y multi-tenant",
    description:
      "Tus documentos quedan aislados a nivel base de datos. Nadie fuera de tu organización los ve.",
  },
  {
    icon: Zap,
    title: "Listo en minutos",
    description:
      "Subí PDFs o TXT y empezá a preguntar. Sin configuración ni infraestructura que mantener.",
  },
];

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/documents");

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold tracking-tight text-brand">Sage</span>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          Iniciar sesión
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[460px] bg-gradient-to-b from-brand-soft to-white" />

        <div className="mx-auto max-w-3xl px-6 pt-12 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-medium text-brand-strong">
            Sistema RAG · Respuestas con citas
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Tu conocimiento, al alcance de una pregunta
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            Sage es tu asistente de IA privado, entrenado con los documentos de tu empresa. Subí
            PDFs y archivos de texto, hacé preguntas, y obtené respuestas con citas a la fuente
            exacta.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className={buttonClasses("primary", "lg")}>
              Empezar gratis
            </Link>
            <Link href="/sign-in" className={buttonClasses("secondary", "lg")}>
              Iniciar sesión
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 pb-20">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-indigo-100 ring-1 ring-black/5">
            <Image
              src="/sage-demo.png"
              alt="Sage respondiendo una pregunta con citas desde documentos subidos"
              width={1902}
              height={1096}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-gray-500 sm:flex-row">
          <p>Desarrollado por Santiago Coronel</p>
          <div className="flex gap-5">
            <a
              href="https://www.linkedin.com/in/santiago-coronel-22825a1a8"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gray-900"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com/Santi-coronel"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gray-900"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
