"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { midpoint } from "@/lib/utils";
import ListColumn from "./ListColumn";
import AddListForm from "./AddListForm";
import CardItem from "./CardItem";

export interface CardData {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  labels: { id: string; cardId: string; colour: string; text: string }[];
}

export interface ListData {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  cards: CardData[];
}

interface BoardViewProps {
  boardId: string;
  boardTitle: string;
  initialLists: ListData[];
}

export default function BoardView({ boardId, initialLists }: BoardViewProps) {
  const router = useRouter();
  const [lists, setLists] = useState<ListData[]>(initialLists);
  const [activeCard, setActiveCard] = useState<CardData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // SSE subscription for real-time collaboration
  useEffect(() => {
    const eventSource = new EventSource(`/api/boards/${boardId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch {
        // Ignore malformed events
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const handleSSEEvent = useCallback(
    (event: Record<string, unknown>) => {
      switch (event.type) {
        case "CARD_MOVED":
          setLists((prev) =>
            prev.map((list) => {
              // Remove card from old list
              const filtered = list.cards.filter(
                (c) => c.id !== event.cardId
              );
              if (list.id === event.listId) {
                // Add card to new list with updated position
                const movedCard = prev
                  .flatMap((l) => l.cards)
                  .find((c) => c.id === event.cardId);
                if (movedCard) {
                  const updated = {
                    ...movedCard,
                    listId: event.listId as string,
                    position: event.position as number,
                  };
                  const newCards = [...filtered, updated].sort(
                    (a, b) => a.position - b.position
                  );
                  return { ...list, cards: newCards };
                }
              }
              return { ...list, cards: filtered.sort((a, b) => a.position - b.position) };
            })
          );
          break;
        case "CARD_CREATED":
          router.refresh();
          break;
        case "CARD_UPDATED":
          router.refresh();
          break;
        case "CARD_DELETED":
          setLists((prev) =>
            prev.map((list) => ({
              ...list,
              cards: list.cards.filter((c) => c.id !== event.cardId),
            }))
          );
          break;
        case "LIST_CREATED":
        case "LIST_UPDATED":
        case "LIST_DELETED":
          router.refresh();
          break;
        default:
          break;
      }
    },
    [router]
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const card = lists.flatMap((l) => l.cards).find((c) => c.id === active.id);
    if (card) {
      setActiveCard(card);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which list the active card is in
    const activeList = lists.find((l) => l.cards.some((c) => c.id === activeId));
    if (!activeList) return;

    // Check if we're over a card or a list
    const overList = lists.find(
      (l) => l.id === overId || l.cards.some((c) => c.id === overId)
    );
    if (!overList) return;

    if (activeList.id !== overList.id) {
      // Moving to a different list — optimistic update
      setLists((prev) => {
        const activeCard = activeList.cards.find((c) => c.id === activeId);
        if (!activeCard) return prev;

        return prev.map((list) => {
          if (list.id === activeList.id) {
            return {
              ...list,
              cards: list.cards.filter((c) => c.id !== activeId),
            };
          }
          if (list.id === overList.id) {
            const overIndex = list.cards.findIndex((c) => c.id === overId);
            const newCards = [...list.cards];
            const insertIndex = overIndex >= 0 ? overIndex : newCards.length;
            newCards.splice(insertIndex, 0, { ...activeCard, listId: overList.id });
            return { ...list, cards: newCards };
          }
          return list;
        });
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Find the current list of the active card (after optimistic update from dragOver)
    const activeList = lists.find((l) => l.cards.some((c) => c.id === activeId));
    if (!activeList) return;

    const overList = lists.find(
      (l) => l.id === overId || l.cards.some((c) => c.id === overId)
    );
    if (!overList) return;

    const activeIndex = activeList.cards.findIndex((c) => c.id === activeId);
    const overIndex = overList.cards.findIndex((c) => c.id === overId);

    let newPosition: number;
    let newListId: string;

    if (activeList.id === overList.id) {
      // Same list reorder
      const reorderedCards = arrayMove(activeList.cards, activeIndex, overIndex);
      const prevCard = reorderedCards[overIndex - 1] ?? null;
      const nextCard = reorderedCards[overIndex + 1] ?? null;
      newPosition = midpoint(
        prevCard?.position ?? null,
        nextCard?.position ?? null
      );
      newListId = activeList.id;

      // Optimistic UI update
      setLists((prev) =>
        prev.map((list) => {
          if (list.id === activeList.id) {
            const updated = reorderedCards.map((c, i) =>
              i === overIndex ? { ...c, position: newPosition } : c
            );
            return { ...list, cards: updated };
          }
          return list;
        })
      );
    } else {
      // Cross-list move
      newListId = overList.id;
      const targetCards = overList.cards;
      const actualOverIndex = targetCards.findIndex((c) => c.id === overId);

      if (actualOverIndex === -1) {
        // Dropped on a list (empty or at end)
        const lastCard = targetCards[targetCards.length - 1] ?? null;
        newPosition = midpoint(lastCard?.position ?? null, null);
      } else {
        const prevCard = targetCards[actualOverIndex - 1] ?? null;
        const nextCard = targetCards[actualOverIndex] ?? null;
        newPosition = midpoint(
          prevCard?.position ?? null,
          nextCard?.position ?? null
        );
      }

      // Final optimistic update with correct position
      setLists((prev) =>
        prev.map((list) => {
          if (list.id === activeList.id) {
            return {
              ...list,
              cards: list.cards.filter((c) => c.id !== activeId),
            };
          }
          if (list.id === newListId) {
            const updatedCards = list.cards.map((c) =>
              c.id === activeId ? { ...c, position: newPosition, listId: newListId } : c
            );
            return {
              ...list,
              cards: updatedCards.sort((a, b) => a.position - b.position),
            };
          }
          return list;
        })
      );
    }

    // Persist the move via API
    try {
      await fetch(`/api/boards/${boardId}/cards/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: newListId, position: newPosition }),
      });
      router.refresh();
    } catch {
      // On error, revert by refreshing
      router.refresh();
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board-scroll flex items-start gap-3 p-4 h-full">
        {lists.map((list) => (
          <ListColumn
            key={list.id}
            boardId={boardId}
            list={list}
            cards={list.cards}
          />
        ))}
        <AddListForm boardId={boardId} />
      </div>
      <DragOverlay>
        {activeCard ? (
          <CardItem
            boardId={boardId}
            card={activeCard}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
