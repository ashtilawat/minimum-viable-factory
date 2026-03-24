"use client";

import { useState } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { MoreHorizontal, Archive } from "lucide-react";
import { CardItem } from "./CardItem";
import { AddCardForm } from "./AddCardForm";
import type { ListWithCards } from "@/types";

interface ListColumnProps {
  list: ListWithCards;
  index: number;
  boardId: string;
  onRefresh: () => void;
}

export function ListColumn({ list, index, boardId, onRefresh }: ListColumnProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleArchiveList = async () => {
    const res = await fetch(`/api/boards/${boardId}/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (res.ok) {
      onRefresh();
    }
  };

  return (
    <Draggable draggableId={`list-${list.id}`} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="flex-shrink-0 w-[272px] rounded-lg bg-trello-list-bg shadow"
        >
          {/* List header */}
          <div
            {...provided.dragHandleProps}
            className="flex items-center justify-between px-3 py-2"
          >
            <h3 className="text-sm font-semibold text-gray-800">{list.title}</h3>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded p-1 hover:bg-gray-300 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded bg-white shadow-lg border border-gray-200">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleArchiveList();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Archive size={14} />
                    Archive list
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cards */}
          <Droppable droppableId={list.id} type="CARD">
            {(dropProvided, snapshot) => (
              <div
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                className={[
                  "min-h-[2px] px-2",
                  snapshot.isDraggingOver ? "bg-blue-100/50" : "",
                ].join(" ")}
              >
                {list.cards.map((card, cardIndex) => (
                  <Draggable
                    key={card.id}
                    draggableId={card.id}
                    index={cardIndex}
                  >
                    {(cardProvided) => (
                      <div
                        ref={cardProvided.innerRef}
                        {...cardProvided.draggableProps}
                        {...cardProvided.dragHandleProps}
                      >
                        <CardItem card={card} boardId={boardId} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Add card */}
          <div className="px-2 pb-2">
            <AddCardForm boardId={boardId} listId={list.id} onCardAdded={onRefresh} />
          </div>
        </div>
      )}
    </Draggable>
  );
}
