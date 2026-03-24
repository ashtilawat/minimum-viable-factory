"use client";

import { useState } from "react";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import type { ChecklistItem } from "@prisma/client";
import { Button } from "@/components/ui/Button";

interface CardChecklistProps {
  cardId: string;
  boardId: string;
  items: ChecklistItem[];
  onUpdate: (items: ChecklistItem[]) => void;
}

export function CardChecklist({ cardId, boardId, items, onUpdate }: CardChecklistProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const completedCount = items.filter((i) => i.completed).length;

  const handleToggle = async (item: ChecklistItem) => {
    const res = await fetch(
      `/api/boards/${boardId}/cards/${cardId}/checklist?itemId=${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !item.completed }),
      }
    );
    if (res.ok) {
      onUpdate(items.map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i)));
    }
  };

  const handleAdd = async () => {
    if (!newItemText.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/cards/${cardId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newItemText.trim() }),
      });
      if (res.ok) {
        const item = await res.json();
        onUpdate([...items, item]);
        setNewItemText("");
        setIsAdding(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    const res = await fetch(
      `/api/boards/${boardId}/cards/${cardId}/checklist?itemId=${itemId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdate(items.filter((i) => i.id !== itemId));
    }
  };

  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">Checklist</h3>
        </div>
        <span className="text-xs text-gray-500">{completedCount}/{items.length}</span>
      </div>
      {items.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-6 text-right">{progress}%</span>
            <div className="flex-1 h-2 rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-trello-green transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-gray-100">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggle(item)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-trello-blue"
            />
            <span className={["flex-1 text-sm", item.completed ? "line-through text-gray-400" : "text-gray-700"].join(" ")}>
              {item.text}
            </span>
            <button
              onClick={() => handleDelete(item.id)}
              className="hidden group-hover:block rounded p-0.5 text-gray-400 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 flex items-center gap-1 rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300"
        >
          <Plus size={14} />
          Add an item
        </button>
      ) : (
        <div className="mt-2">
          <textarea
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Add an item"
            rows={2}
            className="mb-2 w-full resize-none rounded border border-trello-blue px-3 py-2 text-sm focus:outline-none"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } if (e.key === "Escape") setIsAdding(false); }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} isLoading={isLoading}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
