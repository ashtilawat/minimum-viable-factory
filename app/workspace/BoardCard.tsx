'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Board {
  id: string;
  title: string;
  createdAt: string;
  _count?: {
    lists: number;
  };
}

interface BoardCardProps {
  board: Board;
  onDeleted?: () => void;
}

export default function BoardCard({ board, onDeleted }: BoardCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/boards/${board.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted?.();
      }
    } catch {
      // ignore — user can retry
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="group relative rounded-lg bg-blue-600 p-4 text-white shadow-md transition-shadow hover:shadow-lg">
      <Link
        href={`/board/${board.id}`}
        className="block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
      >
        <h3 className="truncate pr-8 text-lg font-semibold">{board.title}</h3>
        {board._count !== undefined && (
          <p className="mt-1 text-sm text-blue-100">
            {board._count.lists} {board._count.lists === 1 ? 'list' : 'lists'}
          </p>
        )}
      </Link>

      {!showConfirm ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowConfirm(true);
          }}
          className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-blue-500 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={`Delete board "${board.title}"`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      ) : (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded bg-red-500 px-2 py-1 text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            aria-label="Confirm delete"
          >
            {isDeleting ? '…' : 'Delete'}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowConfirm(false);
            }}
            className="rounded bg-blue-500 px-2 py-1 text-xs font-medium hover:bg-blue-400 transition-colors"
            aria-label="Cancel delete"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
