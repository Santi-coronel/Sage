import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Tu asistente de IA privado, entrenado con los documentos de tu empresa. Subí PDFs y archivos de texto, y obtené respuestas con citas a la fuente.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sage-nu-six.vercel.app"),
  title: "Sage — Asistente de conocimiento",
  description,
  openGraph: {
    title: "Sage — Asistente de conocimiento",
    description,
    url: "/",
    siteName: "Sage",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sage — Asistente de conocimiento",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#4f46e5",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html
        lang="es"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
      </html>
    </ClerkProvider>
  );
}
