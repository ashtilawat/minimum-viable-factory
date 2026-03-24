"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { CardData } from "./BoardView";

interface CardItemProps {
  boardId: string;
  card: CardData;
  isOverlay?: boolean;
}

function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isDueSoon(dueDate: string): boolean {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000; // within 3 days
}

function isOverdue(dueDate: string): boolean {
  const due = new Date(dueDate);
  return due < new Date();
}

export default function CardItem({ boardId, card, isOverlay = false }: CardItemProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete card "${card.title}"?`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/boards/${boardId}/cards/${card.id}`, {
        method: "DELETE",
      });
      router.refresh();
    } catch {
      setIsDeleting(false);
    }
  }

  function handleCardClick(e: React.MouseEvent) {
    // Don't navigate if clicking delete button
    if ((e.target as HTMLElement).closest("[data-delete-btn]")) return;
    router.push(`/board/${boardId}/card/${card.id}`);
  }

  const dueDateColor =
    card.dueDate && isOverdue(card.dueDate)
      ? "bg-red-100 text-red-700"
      : card.dueDate && isDueSoon(card.dueDate)
      ? "bg-yellow-100 text-yellow-700"
      : "bg-gray-100 text-gray-600";

  if (isOverlay) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-blue-300 px-3 py-2 w-60 opacity-90 rotate-2">
        <p className="text-sm font-medium text-gray-800 truncate">{card.title}</p>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative group bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2 cursor-pointer hover:shadow-md transition-shadow",
        isDragging && "opacity-40 shadow-lg border-blue-300",
        isDeleting && "opacity-50"
      )}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      onClick={handleCardClick}
    >
      {/* Label dots */}
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="inline-block h-2 rounded-full"
              style={{ backgroundColor: label.colour, width: label.text ? "auto" : "2rem", paddingLeft: label.text ? "0.5rem" : undefined, paddingRight: label.text ? "0.5rem" : undefined }}
              title={label.text || label.colour}
            >
              {label.text && (
                <span className="text-white text-xs leading-none">{label.text}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Card Title */}
      <p className="text-sm text-gray-800 leading-snug break-words">{card.title}</p>

      {/* Due Date */}
      {card.dueDate && (
        <div className="mt-1.5">
          <span className={cn("inline-flex items-center text-xs px-1.5 py-0.5 rounded", dueDateColor)}>
            <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDueDate(card.dueDate)}
          </span>
        </div>
      )}

      {/* Delete Button */}
      {showDelete && !isDragging && (
        <button
          data-delete-btn
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs leading-none opacity-0 group-hover:opacity-100 disabled:opacity-50"
          title="Delete card"
          aria-label="Delete card"
        >
          &times;
        </button>
      )}
    </div>
  );
}
