"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LayoutGrid, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  userEmail?: string | null;
  userName?: string | null;
}

export function Header({ userEmail, userName }: HeaderProps) {
  return (
    <header className="flex h-12 items-center justify-between bg-trello-board-bg/90 px-4 text-white shadow">
      <Link href="/boards" className="flex items-center gap-2 font-bold text-lg hover:opacity-90">
        <LayoutGrid size={20} />
        Taskboard
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-90">{userName ?? userEmail}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut size={14} className="mr-1" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
