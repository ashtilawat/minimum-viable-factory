"use client";

import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import type { Label } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";

interface CardLabelsProps {
  cardId: string;
  boardId: string;
  labels: Label[];
  onUpdate: (labels: Label[]) => void;
}

export function CardLabels({ cardId, boardId, labels, onUpdate }: CardLabelsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newColor, setNewColor] = useState("#0079BF");
  const [newText, setNewText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/cards/${cardId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: newColor, text: newText || undefined }),
      });
      if (res.ok) {
        const label = await res.json();
        onUpdate([...labels, label]);
        setIsAdding(false);
        setNewText("");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (labelId: string) => {
    const res = await fetch(
      `/api/boards/${boardId}/cards/${cardId}/labels?labelId=${labelId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdate(labels.filter((l) => l.id !== labelId));
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Tag size={16} className="text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-700">Labels</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <div key={label.id} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white" style={{ backgroundColor: label.color }}>
            {label.text ?? label.color}
            <button onClick={() => handleRemove(label.id)} className="ml-1 opacity-70 hover:opacity-100">
              <X size={10} />
            </button>
          </div>
        ))}
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 rounded border border-dashed border-gray-400 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200"
          >
            <Plus size={10} />
            Add label
          </button>
        )}
      </div>
      {isAdding && (
        <div className="mt-3 rounded-lg bg-white p-3 shadow">
          <p className="mb-2 text-xs font-semibold text-gray-600">Select a color</p>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Label name (optional)"
            className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-trello-blue focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={handleAdd} isLoading={isSaving}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
