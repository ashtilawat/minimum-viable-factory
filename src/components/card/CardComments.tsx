"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CommentWithAuthor } from "@/types";

interface CardCommentsProps {
  cardId: string;
  boardId: string;
  comments: CommentWithAuthor[];
  currentUserId: string;
  onUpdate: (comments: CommentWithAuthor[]) => void;
}

export function CardComments({ cardId, boardId, comments, currentUserId, onUpdate }: CardCommentsProps) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/cards/${cardId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        onUpdate([...comments, comment]);
        setText("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={16} className="text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-700">Activity</h3>
      </div>
      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          rows={3}
          className="mb-2 w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:border-trello-blue focus:outline-none"
        />
        {text.trim() && (
          <Button type="submit" size="sm" isLoading={isLoading}>
            Save
          </Button>
        )}
      </form>
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="h-7 w-7 flex-shrink-0 rounded-full bg-trello-blue text-white text-xs flex items-center justify-center font-semibold">
              {(comment.author.name ?? comment.author.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {comment.author.name ?? comment.author.email}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
              </div>
              <div className="mt-1 rounded bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                {comment.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
