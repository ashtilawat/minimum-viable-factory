"use client";

import { useState } from "react";
import { AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CardDescriptionProps {
  cardId: string;
  boardId: string;
  description: string | null;
  onUpdate: (description: string | null) => void;
}

export function CardDescription({ cardId, boardId, description, onUpdate }: CardDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value || null }),
      });
      if (res.ok) {
        onUpdate(value || null);
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <AlignLeft size={16} className="text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-700">Description</h3>
      </div>
      {isEditing ? (
        <div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a more detailed description..."
            rows={5}
            className="mb-2 w-full resize-none rounded border border-trello-blue px-3 py-2 text-sm focus:outline-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} isLoading={isSaving}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue(description ?? "");
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="min-h-[56px] cursor-pointer rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          {description || <span className="text-gray-400">Add a more detailed description…</span>}
        </div>
      )}
    </div>
  );
}
