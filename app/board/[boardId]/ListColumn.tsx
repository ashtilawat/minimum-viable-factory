"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import CardItem from "./CardItem";
import AddCardForm from "./AddCardForm";
import type { ListData, CardData } from "./BoardView";

interface ListColumnProps {
  boardId: string;
  list: ListData;
  cards: CardData[];
}

export default function ListColumn({ boardId, list, cards }: ListColumnProps) {
  const router = useRouter();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(list.title);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
  });

  const cardIds = cards.map((c) => c.id);

  function handleTitleClick() {
    setIsEditingTitle(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleTitleBlur() {
    if (titleValue.trim() === "" || titleValue === list.title) {
      setTitleValue(list.title);
      setIsEditingTitle(false);
      return;
    }
    setIsSaving(true);
    try {
      await fetch(`/api/boards/${boardId}/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue.trim() }),
      });
      router.refresh();
    } catch {
      setTitleValue(list.title);
    } finally {
      setIsSaving(false);
      setIsEditingTitle(false);
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setTitleValue(list.title);
      setIsEditingTitle(false);
    }
  }

  async function handleDeleteList() {
    if (!confirm(`Delete list "${list.title}"? All cards will be deleted.`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/boards/${boardId}/lists/${list.id}`, {
        method: "DELETE",
      });
      router.refresh();
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-gray-100 rounded-xl shadow-sm w-64 flex-shrink-0 max-h-full",
        isOver && "ring-2 ring-blue-400"
      )}
    >
      {/* List Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1 gap-2">
        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            disabled={isSaving}
            className="flex-1 text-sm font-semibold bg-white border border-blue-400 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-300"
            maxLength={255}
          />
        ) : (
          <h2
            className="flex-1 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 rounded px-2 py-0.5 truncate"
            onClick={handleTitleClick}
            title="Click to rename"
          >
            {list.title}
          </h2>
        )}
        <button
          onClick={handleDeleteList}
          disabled={isDeleting}
          className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none flex-shrink-0 disabled:opacity-50"
          title="Delete list"
          aria-label="Delete list"
        >
          &times;
        </button>
      </div>

      {/* Card Count */}
      <div className="px-3 pb-1">
        <span className="text-xs text-gray-400">{cards.length} card{cards.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 px-2 pb-2 overflow-y-auto flex-1 min-h-[2rem]"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <CardItem
              key={card.id}
              boardId={boardId}
              card={card}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add Card Form */}
      <div className="px-2 pb-2">
        <AddCardForm boardId={boardId} listId={list.id} />
      </div>
    </div>
  );
}
