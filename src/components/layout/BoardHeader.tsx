"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

interface BoardHeaderProps {
  boardId: string;
  title: string;
  bgColor: string;
}

export function BoardHeader({ boardId, title, bgColor }: BoardHeaderProps) {
  return (
    <div
      className="flex h-12 items-center justify-between px-4 text-white"
      style={{ backgroundColor: bgColor }}
    >
      <h1 className="text-lg font-bold">{title}</h1>
      <Link
        href={`/boards/${boardId}/settings`}
        className="flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-white/20 transition-colors"
      >
        <Settings size={14} />
        Settings
      </Link>
    </div>
  );
}
