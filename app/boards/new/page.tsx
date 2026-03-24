"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ColorPicker } from "@/components/ui/ColorPicker";

export default function NewBoardPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [bgColor, setBgColor] = useState("#0079BF");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), bgColor }),
      });
      if (res.ok) {
        const board = await res.json();
        router.push(`/boards/${board.id}`);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to create board");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-12 items-center bg-trello-board-bg/90 px-4 text-white">
        <Link href="/boards" className="flex items-center gap-1 text-sm hover:opacity-80">
          <ArrowLeft size={16} />
          Back to boards
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="mb-6 text-xl font-bold text-gray-800">Create a new board</h1>

          {/* Preview */}
          <div
            className="mb-6 flex h-24 items-center justify-center rounded-lg shadow"
            style={{ backgroundColor: bgColor }}
          >
            <p className="text-lg font-semibold text-white">{title || "Board title"}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
            <Input
              label="Board title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My project board"
              required
              autoFocus
            />
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Background color
              </label>
              <ColorPicker value={bgColor} onChange={setBgColor} />
            </div>
            {error && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create board
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
