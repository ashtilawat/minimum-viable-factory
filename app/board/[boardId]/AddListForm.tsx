"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface AddListFormProps {
  boardId: string;
}

export default function AddListForm({ boardId }: AddListFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setIsOpen(true);
    setTitle("");
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
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
      setError("List name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/boards/${boardId}/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create list");
        return;
      }

      setTitle("");
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Failed to create list");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-white text-sm font-medium px-3 py-2 rounded-xl bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors w-64 flex-shrink-0 whitespace-nowrap"
      >
        <span className="text-lg leading-none">+</span>
        <span>Add a list</span>
      </button>
    );
  }

  return (
    <div className="bg-gray-100 rounded-xl shadow-sm w-64 flex-shrink-0 p-2">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter list title..."
          disabled={isSubmitting}
          maxLength={255}
          className="w-full text-sm border border-blue-400 rounded px-2 py-1.5 mb-2 outline-none focus:ring-2 focus:ring-blue-300 bg-white disabled:opacity-50"
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
            {isSubmitting ? "Adding..." : "Add list"}
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
