"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardMember {
  userId: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
  };
}

interface Board {
  id: string;
  title: string;
  ownerId: string;
  owner: {
    id: string;
    email: string;
  };
  members: BoardMember[];
}

interface BoardSettingsClientProps {
  board: Board;
  isOwner: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BoardSettingsClient({
  board: initialBoard,
  isOwner,
}: BoardSettingsClientProps) {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [boardTitle, setBoardTitle] = useState(initialBoard.title);
  const [members, setMembers] = useState<BoardMember[]>(initialBoard.members);

  // Rename state
  const [newTitle, setNewTitle] = useState(initialBoard.title);
  const [renameError, setRenameError] = useState("");
  const [renameSuccess, setRenameSuccess] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Remove member state
  const [removeError, setRemoveError] = useState("");

  function refresh() {
    startTransition(() => router.refresh());
  }

  // ── Rename board ──────────────────────────────────────────────────────────

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setRenameError("");
    setRenameSuccess(false);

    if (!newTitle.trim()) {
      setRenameError("Title cannot be empty.");
      return;
    }

    const res = await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRenameError(data.error ?? "Failed to rename board.");
      return;
    }

    const updated = await res.json();
    setBoardTitle(updated.title);
    setRenameSuccess(true);
    refresh();
  }

  // ── Invite member ─────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");

    if (!inviteEmail.trim()) {
      setInviteError("Email cannot be empty.");
      return;
    }

    const res = await fetch(`/api/boards/${boardId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setInviteError(data.error ?? "Failed to invite member.");
      return;
    }

    const membership: BoardMember = await res.json();
    setMembers((prev) => [...prev, membership]);
    setInviteSuccess(`${inviteEmail.trim()} has been added to the board.`);
    setInviteEmail("");
    refresh();
  }

  // ── Remove member ─────────────────────────────────────────────────────────

  async function handleRemoveMember(userId: string) {
    setRemoveError("");

    const res = await fetch(`/api/boards/${boardId}/members/${userId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRemoveError(data.error ?? "Failed to remove member.");
      return;
    }

    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    refresh();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Rename board ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">
          Board name
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Current name:{" "}
          <span className="font-medium text-gray-700">{boardTitle}</span>
        </p>

        {isOwner ? (
          <form onSubmit={handleRename} className="flex gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                setRenameSuccess(false);
              }}
              required
              maxLength={255}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="New board title"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-400">
            Only the board owner can rename this board.
          </p>
        )}

        {renameError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {renameError}
          </p>
        )}
        {renameSuccess && (
          <p className="mt-2 text-sm text-green-600" role="status">
            Board renamed successfully.
          </p>
        )}
      </section>

      {/* ── Members ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">Members</h2>

        <ul className="divide-y divide-gray-100">
          {/* Owner row */}
          <li className="flex items-center justify-between py-2.5">
            <div>
              <span className="text-sm text-gray-800">
                {initialBoard.owner.email}
              </span>
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Owner
              </span>
            </div>
          </li>

          {/* Member rows */}
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between py-2.5"
            >
              <span className="text-sm text-gray-800">{member.user.email}</span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.userId)}
                  disabled={isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 focus:outline-none focus:underline"
                  aria-label={`Remove ${member.user.email}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}

          {members.length === 0 && (
            <li className="py-2.5 text-sm text-gray-400">
              No additional members yet.
            </li>
          )}
        </ul>

        {removeError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {removeError}
          </p>
        )}

        {/* Invite form — only owners can invite */}
        {isOwner && (
          <div className="mt-5 border-t border-gray-100 pt-5">
            <h3 className="mb-3 text-sm font-medium text-gray-700">
              Invite a member by email
            </h3>
            <form onSubmit={handleInvite} className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteSuccess("");
                  setInviteError("");
                }}
                required
                placeholder="colleague@example.com"
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Email address to invite"
              />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Invite
              </button>
            </form>
            {inviteError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {inviteError}
              </p>
            )}
            {inviteSuccess && (
              <p className="mt-2 text-sm text-green-600" role="status">
                {inviteSuccess}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
