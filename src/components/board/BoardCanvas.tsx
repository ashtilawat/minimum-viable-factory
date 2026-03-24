"use client";

import { useState, useCallback, Suspense } from "react";
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ListColumn } from "./ListColumn";
import { AddListForm } from "./AddListForm";
import { CardModal } from "@/components/card/CardModal";
import { getPositionBetween } from "@/lib/ordering";
import type { BoardPageData } from "@/types";

interface BoardCanvasProps {
  initialBoard: BoardPageData;
  currentUserId: string;
}

export function BoardCanvas({ initialBoard, currentUserId }: BoardCanvasProps) {
  const [board, setBoard] = useState(initialBoard);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/boards/${board.id}`);
    if (res.ok) {
      const data = await res.json();
      setBoard(data);
    }
  }, [board.id]);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, type, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      if (type === "LIST") {
        // Reorder lists
        const lists = [...board.lists];
        const [moved] = lists.splice(source.index, 1);
        lists.splice(destination.index, 0, moved);

        // Calculate new position
        const before = lists[destination.index - 1]?.position ?? null;
        const after = lists[destination.index + 1]?.position ?? null;
        const newPosition = getPositionBetween(before, after);

        // Optimistic update
        const updatedLists = lists.map((l, i) =>
          i === destination.index ? { ...l, position: newPosition } : l
        );
        setBoard((prev) => ({ ...prev, lists: updatedLists }));

        await fetch(`/api/boards/${board.id}/lists/${moved.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: newPosition }),
        });
      } else if (type === "CARD") {
        // Reorder / move card
        const sourceListIndex = board.lists.findIndex((l) => l.id === source.droppableId);
        const destListIndex = board.lists.findIndex((l) => l.id === destination.droppableId);
        if (sourceListIndex === -1 || destListIndex === -1) return;

        const newLists = board.lists.map((l) => ({ ...l, cards: [...l.cards] }));
        const [movedCard] = newLists[sourceListIndex].cards.splice(source.index, 1);
        newLists[destListIndex].cards.splice(destination.index, 0, movedCard);

        const destCards = newLists[destListIndex].cards;
        const before = destCards[destination.index - 1]?.position ?? null;
        const after = destCards[destination.index + 1]?.position ?? null;
        const newPosition = getPositionBetween(before, after);

        newLists[destListIndex].cards[destination.index] = {
          ...movedCard,
          position: newPosition,
          listId: destination.droppableId,
        };

        setBoard((prev) => ({ ...prev, lists: newLists }));

        await fetch(`/api/boards/${board.id}/cards/${movedCard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position: newPosition,
            listId: destination.droppableId,
          }),
        });
      }
    },
    [board]
  );

  return (
    <div className="flex h-full flex-col">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="LIST">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex flex-1 gap-3 overflow-x-auto p-4 pb-6"
            >
              {board.lists.map((list, index) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  index={index}
                  boardId={board.id}
                  onRefresh={refresh}
                />
              ))}
              {provided.placeholder}
              <AddListForm boardId={board.id} onListAdded={refresh} />
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Suspense>
        <CardModal
          boardId={board.id}
          currentUserId={currentUserId}
          onBoardRefresh={refresh}
        />
      </Suspense>
    </div>
  );
}
