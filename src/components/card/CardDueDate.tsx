"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CardDueDateProps {
  cardId: string;
  boardId: string;
  dueDate: string | null;
  onUpdate: (dueDate: string | null) => void;
}

export function CardDueDate({ cardId, boardId, dueDate, onUpdate }: CardDueDateProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(
    dueDate ? format(new Date(dueDate), "yyyy-MM-dd") : ""
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: value || null }),
      });
      if (res.ok) {
        onUpdate(value || null);
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isOverdue = dueDate && new Date(dueDate) < new Date();

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Clock size={16} className="text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-700">Due Date</h3>
      </div>
      {isEditing ? (
        <div>
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mb-2 rounded border border-trello-blue px-3 py-1.5 text-sm focus:outline-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} isLoading={isSaving}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setValue(dueDate ? format(new Date(dueDate), "yyyy-MM-dd") : ""); setIsEditing(false); }}>Cancel</Button>
            {dueDate && (
              <Button size="sm" variant="danger" onClick={async () => { setIsSaving(true); const res = await fetch(`/api/boards/${boardId}/cards/${cardId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDate: null }) }); if (res.ok) { onUpdate(null); setIsEditing(false); } setIsSaving(false); }}>
                Remove
              </Button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className={[
            "flex items-center gap-2 rounded px-3 py-1.5 text-sm",
            dueDate
              ? isOverdue
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200",
          ].join(" ")}
        >
          <Clock size={14} />
          {dueDate ? format(new Date(dueDate), "MMM d, yyyy") : "Add due date"}
          {isOverdue && <span className="text-xs font-semibold text-red-600">Overdue</span>}
        </button>
      )}
    </div>
  );
}
