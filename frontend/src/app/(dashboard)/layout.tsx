"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { FileText, MessageSquare } from "lucide-react";

const navItems = [
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-8">
          <Link href="/documents" className="text-xl font-bold text-brand tracking-tight">
            Sage
          </Link>
          <nav className="flex gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-soft text-brand-strong"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserButton />
      </header>
      <main className="flex-1 flex flex-col container mx-auto max-w-5xl w-full px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
