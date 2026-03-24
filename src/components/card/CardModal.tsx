"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Archive, CreditCard } from "lucide-react";
import { CardDescription } from "./CardDescription";
import { CardLabels } from "./CardLabels";
import { CardDueDate } from "./CardDueDate";
import { CardChecklist } from "./CardChecklist";
import { CardComments } from "./CardComments";
import type { CardDetail } from "@/types";

interface CardModalProps {
  boardId: string;
  currentUserId: string;
  onBoardRefresh: () => void;
}

export function CardModal({ boardId, currentUserId, onBoardRefresh }: CardModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId");

  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cardId) {
      setCard(null);
      return;
    }
    setLoading(true);
    fetch(`/api/boards/${boardId}/cards/${cardId}`)
      .then((r) => r.json())
      .then((data) => setCard(data))
      .finally(() => setLoading(false));
  }, [cardId, boardId]);

  const handleClose = () => {
    router.push(`/boards/${boardId}`);
  };

  const handleArchive = async () => {
    if (!card) return;
    const res = await fetch(`/api/boards/${boardId}/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (res.ok) {
      onBoardRefresh();
      handleClose();
    }
  };

  const isOpen = !!cardId;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg bg-trello-list-bg shadow-xl max-h-[90vh] overflow-y-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-trello-blue border-t-transparent" />
            </div>
          ) : card ? (
            <div>
              {/* Modal Header */}
              <div className="sticky top-0 bg-trello-list-bg px-4 pt-4 pb-2 border-b border-gray-200">
                <div className="flex items-start gap-3">
                  <CreditCard size={20} className="mt-0.5 text-gray-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Dialog.Title className="text-base font-semibold text-gray-800 break-words">
                      {card.title}
                    </Dialog.Title>
                    <p className="text-xs text-gray-500 mt-0.5">
                      in list <span className="font-medium">{card.list.title}</span>
                    </p>
                  </div>
                  <Dialog.Close className="rounded p-1 text-gray-500 hover:bg-gray-200 flex-shrink-0">
                    <X size={16} />
                  </Dialog.Close>
                </div>
              </div>

              {/* Modal Body */}
              <div className="grid grid-cols-3 gap-4 p-4">
                <div className="col-span-2 space-y-5">
                  <CardDescription
                    cardId={card.id}
                    boardId={boardId}
                    description={card.description}
                    onUpdate={(desc) => setCard((c) => c ? { ...c, description: desc } : c)}
                  />
                  <CardChecklist
                    cardId={card.id}
                    boardId={boardId}
                    items={card.checklistItems}
                    onUpdate={(items) => setCard((c) => c ? { ...c, checklistItems: items } : c)}
                  />
                  <CardComments
                    cardId={card.id}
                    boardId={boardId}
                    comments={card.comments}
                    currentUserId={currentUserId}
                    onUpdate={(comments) => setCard((c) => c ? { ...c, comments } : c)}
                  />
                </div>
                <div className="space-y-3">
                  <CardLabels
                    cardId={card.id}
                    boardId={boardId}
                    labels={card.labels}
                    onUpdate={(labels) => setCard((c) => c ? { ...c, labels } : c)}
                  />
                  <CardDueDate
                    cardId={card.id}
                    boardId={boardId}
                    dueDate={card.dueDate ? card.dueDate.toString() : null}
                    onUpdate={(dueDate) => setCard((c) => c ? { ...c, dueDate: dueDate ? new Date(dueDate) : null } : c)}
                  />
                  <div className="border-t border-gray-200 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Actions</p>
                    <button
                      onClick={handleArchive}
                      className="flex w-full items-center gap-2 rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300"
                    >
                      <Archive size={14} />
                      Archive card
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
