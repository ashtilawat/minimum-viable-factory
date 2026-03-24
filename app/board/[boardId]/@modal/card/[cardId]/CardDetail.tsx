"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LabelBadge from "@/components/ui/LabelBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Label {
  id: string;
  colour: string;
  text: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    email: string;
  };
}

interface Card {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  listId: string;
  labels: Label[];
  comments: Comment[];
}

interface CardDetailProps {
  card: Card;
  boardId: string;
  currentUserId: string;
}

// ─── Preset label colours ────────────────────────────────────────────────────

const PRESET_COLOURS = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#eab308", name: "Yellow" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#8b5cf6", name: "Purple" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#14b8a6", name: "Teal" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CardDetail({
  card,
  boardId,
  currentUserId,
}: CardDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Card fields
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [dueDate, setDueDate] = useState(
    card.dueDate ? card.dueDate.slice(0, 10) : ""
  );
  const [labels, setLabels] = useState<Label[]>(card.labels);
  const [comments, setComments] = useState<Comment[]>(card.comments);

  // New label form state
  const [newLabelColour, setNewLabelColour] = useState(PRESET_COLOURS[0].hex);
  const [newLabelText, setNewLabelText] = useState("");

  // New comment form state
  const [newComment, setNewComment] = useState("");

  // Error messages
  const [cardError, setCardError] = useState("");
  const [commentError, setCommentError] = useState("");

  // ── Helpers ────────────────────────────────────────────────────────────────

  const cardApiUrl = `/api/boards/${boardId}/cards/${card.id}`;
  const commentsApiUrl = `/api/boards/${boardId}/cards/${card.id}/comments`;

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  // ── Save card (title, description, dueDate) ───────────────────────────────

  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault();
    setCardError("");

    // Build ISO datetime string for the API or null
    let dueDateValue: string | null = null;
    if (dueDate) {
      dueDateValue = new Date(dueDate).toISOString();
    }

    const res = await fetch(cardApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || card.title,
        description: description || null,
        dueDate: dueDateValue,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCardError(data.error ?? "Failed to save card.");
      return;
    }

    refresh();
  }

  // ── Labels ─────────────────────────────────────────────────────────────────
  // The API replaces all labels atomically when `labels` is provided.

  async function handleAddLabel(e: React.FormEvent) {
    e.preventDefault();
    setCardError("");

    const newLabel = { colour: newLabelColour, text: newLabelText.trim() };
    const updatedLabels = [
      ...labels.map((l) => ({ colour: l.colour, text: l.text })),
      newLabel,
    ];

    const res = await fetch(cardApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels: updatedLabels }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCardError(data.error ?? "Failed to add label.");
      return;
    }

    const updated = await res.json();
    setLabels(updated.labels ?? labels);
    setNewLabelText("");
    refresh();
  }

  async function handleRemoveLabel(labelId: string) {
    setCardError("");

    const updatedLabels = labels
      .filter((l) => l.id !== labelId)
      .map((l) => ({ colour: l.colour, text: l.text }));

    const res = await fetch(cardApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels: updatedLabels }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCardError(data.error ?? "Failed to remove label.");
      return;
    }

    const updated = await res.json();
    setLabels(updated.labels ?? labels.filter((l) => l.id !== labelId));
    refresh();
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentError("");

    if (!newComment.trim()) return;

    const res = await fetch(commentsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCommentError(data.error ?? "Failed to post comment.");
      return;
    }

    const comment: Comment = await res.json();
    setComments((prev) => [...prev, comment]);
    setNewComment("");
    refresh();
  }

  async function handleDeleteComment(commentId: string) {
    setCommentError("");

    const res = await fetch(
      `/api/boards/${boardId}/cards/${card.id}/comments/${commentId}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCommentError(data.error ?? "Failed to delete comment.");
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
    refresh();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Card fields ── */}
      <form onSubmit={handleSaveCard} className="space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor="card-title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Title
          </label>
          <input
            id="card-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="card-description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="card-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a more detailed description…"
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Due date */}
        <div>
          <label
            htmlFor="card-due-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Due date
          </label>
          <input
            id="card-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {cardError && (
          <p className="text-sm text-red-600" role="alert">
            {cardError}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <hr className="border-gray-200" />

      {/* ── Labels ── */}
      <section aria-labelledby="labels-heading">
        <h3
          id="labels-heading"
          className="text-sm font-semibold text-gray-700 mb-2"
        >
          Labels
        </h3>

        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {labels.map((label) => (
              <LabelBadge
                key={label.id}
                colour={label.colour}
                text={label.text}
                onRemove={() => handleRemoveLabel(label.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-3">No labels yet.</p>
        )}

        {/* Add label form */}
        <form onSubmit={handleAddLabel} className="flex items-end gap-2 flex-wrap">
          {/* Colour swatches */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Colour</label>
            <div className="flex gap-1.5">
              {PRESET_COLOURS.map(({ hex, name }) => (
                <button
                  key={hex}
                  type="button"
                  title={name}
                  onClick={() => setNewLabelColour(hex)}
                  className="h-6 w-6 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{
                    backgroundColor: hex,
                    boxShadow:
                      newLabelColour === hex
                        ? `0 0 0 2px white, 0 0 0 4px ${hex}`
                        : undefined,
                  }}
                  aria-pressed={newLabelColour === hex}
                  aria-label={name}
                />
              ))}
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-[120px]">
            <label
              htmlFor="new-label-text"
              className="block text-xs text-gray-500 mb-1"
            >
              Label text (optional)
            </label>
            <input
              id="new-label-text"
              type="text"
              value={newLabelText}
              onChange={(e) => setNewLabelText(e.target.value)}
              maxLength={40}
              placeholder="e.g. Bug"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 whitespace-nowrap"
          >
            Add label
          </button>
        </form>
      </section>

      <hr className="border-gray-200" />

      {/* ── Comments ── */}
      <section aria-labelledby="comments-heading">
        <h3
          id="comments-heading"
          className="text-sm font-semibold text-gray-700 mb-3"
        >
          Comments
        </h3>

        {/* Existing comments */}
        <ul className="space-y-3 mb-4">
          {comments.length === 0 && (
            <li className="text-sm text-gray-400">No comments yet.</li>
          )}
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">
                    {comment.author.email}
                    <span className="ml-2 font-normal text-gray-400">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {comment.body}
                  </p>
                </div>
                {comment.author.id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment.id)}
                    disabled={isPending}
                    className="flex-shrink-0 rounded text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-red-400"
                    aria-label="Delete comment"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {commentError && (
          <p className="mb-2 text-sm text-red-600" role="alert">
            {commentError}
          </p>
        )}

        {/* Post comment form */}
        <form onSubmit={handlePostComment} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Post
          </button>
        </form>
      </section>
    </div>
  );
}
