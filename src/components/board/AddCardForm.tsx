"use client";

import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AddCardFormProps {
  boardId: string;
  listId: string;
  onCardAdded: () => void;
}

export function AddCardForm({ boardId, listId, onCardAdded }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/lists/${listId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (res.ok) {
        setTitle("");
        onCardAdded();
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 transition-colors"
      >
        <Plus size={14} />
        Add a card
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter a title for this card..."
        rows={3}
        className="mb-2 w-full resize-none rounded border border-trello-blue px-3 py-2 text-sm focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
          }
          if (e.key === "Escape") setIsOpen(false);
        }}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" isLoading={isLoading}>
          Add card
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
  );
}
