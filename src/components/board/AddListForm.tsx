"use client";

import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AddListFormProps {
  boardId: string;
  onListAdded: () => void;
}

export function AddListForm({ boardId, onListAdded }: AddListFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (res.ok) {
        setTitle("");
        setIsOpen(false);
        onListAdded();
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="flex h-10 min-w-[272px] items-center gap-1 rounded-lg bg-white/30 px-3 text-white text-sm font-medium hover:bg-white/40 transition-colors"
      >
        <Plus size={16} />
        Add a list
      </button>
    );
  }

  return (
    <div className="min-w-[272px] rounded-lg bg-trello-list-bg p-2 shadow">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter list title..."
          className="mb-2 w-full rounded border border-trello-blue px-3 py-2 text-sm focus:outline-none"
          onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" isLoading={isLoading}>
            Add list
          </Button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded p-1 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
