'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import BoardCard from './BoardCard';
import Modal from '@/components/ui/Modal';

interface Board {
  id: string;
  title: string;
  createdAt: string;
  _count: {
    lists: number;
  };
}

export default function WorkspacePage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch('/api/boards');
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch boards');
      const data = await res.json();
      setBoards(data);
    } catch {
      setError('Failed to load boards. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    const title = newBoardTitle.trim();
    if (!title) return;

    setIsCreating(true);
    setError('');
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to create board');
      const created: Board = await res.json();
      setBoards((prev) => [created, ...prev]);
      setNewBoardTitle('');
      setShowCreateModal(false);
    } catch {
      setError('Failed to create board. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  function handleCloseModal() {
    setShowCreateModal(false);
    setNewBoardTitle('');
    setError('');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top nav */}
      <header className="bg-blue-700 px-6 py-3 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xl font-bold tracking-tight">Trello</span>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="rounded px-3 py-1 text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Your Boards</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Board
          </button>
        </div>

        {error && !showCreateModal && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg bg-blue-200"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-20 text-center">
            <svg
              className="mb-4 h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <p className="text-lg font-medium text-gray-600">No boards yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first board to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} onDeleted={() => fetchBoards()} />
            ))}
          </div>
        )}
      </main>

      {/* Create Board Modal */}
      <Modal isOpen={showCreateModal} onClose={handleCloseModal} title="Create Board">
        <form onSubmit={handleCreateBoard} className="flex flex-col gap-4">
          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div>
            <label htmlFor="board-title" className="mb-1 block text-sm font-medium text-gray-700">
              Board title
            </label>
            <input
              id="board-title"
              type="text"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              placeholder="e.g. My Project"
              autoFocus
              maxLength={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !newBoardTitle.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating…' : 'Create Board'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
