"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Calendar, CheckSquare, MessageSquare } from "lucide-react";
import type { CardWithLabels } from "@/types";

interface CardItemProps {
  card: CardWithLabels;
  boardId: string;
}

export function CardItem({ card, boardId }: CardItemProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/boards/${boardId}?cardId=${card.id}`);
  };

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !card.archived;

  return (
    <div
      onClick={handleClick}
      className="mb-2 cursor-pointer rounded-lg bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Label dots */}
      {card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="h-2 w-10 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.text ?? label.color}
            />
          ))}
        </div>
      )}

      <p className="text-sm text-gray-800">{card.title}</p>

      {/* Badges */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {card.dueDate && (
          <span
            className={[
              "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
              isOverdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600",
            ].join(" ")}
          >
            <Calendar size={10} />
            {format(new Date(card.dueDate), "MMM d")}
          </span>
        )}
        {(card._count?.checklistItems ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <CheckSquare size={10} />
            {card._count?.checklistItems}
          </span>
        )}
        {(card._count?.comments ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MessageSquare size={10} />
            {card._count?.comments}
          </span>
        )}
      </div>
    </div>
  );
}
