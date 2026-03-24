"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface AddCardFormProps {
  boardId: string;
  listId: string;
}

export default function AddCardForm({ boardId, listId }: AddCardFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleOpen() {
    setIsOpen(true);
    setTitle("");
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleCancel() {
    setIsOpen(false);
    setTitle("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Card title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/boards/${boardId}/lists/${listId}/cards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create card");
        return;
      }

      setTitle("");
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Failed to create card");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm px-2 py-1.5 rounded hover:bg-gray-200 transition-colors w-full text-left"
      >
        <span className="text-base leading-none">+</span>
        <span>Add a card</span>
      </button>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a title for this card..."
          disabled={isSubmitting}
          rows={3}
          maxLength={500}
          className="w-full text-sm border border-blue-400 rounded px-2 py-1.5 mb-2 outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none disabled:opacity-50"
        />
        {error && (
          <p className="text-red-500 text-xs mb-2">{error}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add card"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none px-1 transition-colors disabled:opacity-50"
            aria-label="Cancel"
          >
            &times;
          </button>
        </div>
      </form>
    </div>
  );
}
