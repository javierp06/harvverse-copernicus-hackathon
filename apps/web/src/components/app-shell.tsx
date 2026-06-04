"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import AppSidebar from "./app-sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const close = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#001020] text-white">
      {/* Atmospheric elements */}
      <div className="atmosphere-blob top-[-10%] right-[-10%] size-[280px] md:size-[500px] bg-primary/20" />
      <div className="atmosphere-blob bottom-[5%] left-[-5%] size-[220px] md:size-[400px] bg-[#67B9C1]/20" />
      <div className="atmosphere-blob top-[20%] left-[20%] hidden size-[300px] bg-[#6766C4]/10 md:block" />

      {/* Mobile top bar — hidden on md+ */}
      <header className="fixed top-0 inset-x-0 h-14 bg-[#000d1a] border-b border-white/5 flex items-center justify-between px-4 z-50 safe-top md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="absolute left-1/2 -translate-x-1/2">
          <img src="/logo-white.png" alt="Harvverse" className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <UserButton />
        </div>
      </header>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={close}
        />
      )}

      <div className="flex">
        <AppSidebar isMobileOpen={sidebarOpen} onClose={close} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 hidden h-14 shrink-0 items-center justify-end gap-3 border-b border-white/5 bg-[#000d1a]/95 px-6 backdrop-blur-md md:flex lg:px-8">
            <LanguageSwitcher />
            <UserButton />
          </header>
          <main className="min-h-screen flex-1 overflow-y-auto overflow-x-hidden p-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:p-6 md:p-8 md:pt-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
