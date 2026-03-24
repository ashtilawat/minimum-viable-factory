import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BoardSettingsClient from "./BoardSettingsClient";

interface PageProps {
  params: { boardId: string };
}

/**
 * Board settings server page.
 *
 * Fetches board data (title, owner, members) server-side and delegates
 * interactive mutations (rename, invite, remove) to the client component.
 */
export default async function BoardSettingsPage({ params }: PageProps) {
  const { boardId } = params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, email: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!board) notFound();

  const serialisedBoard = {
    id: board.id,
    title: board.title,
    ownerId: board.ownerId,
    owner: board.owner,
    members: board.members.map((m) => ({
      userId: m.userId,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    })),
  };

  const isOwner = board.ownerId === session.user.id;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Board settings</h1>
          <Link
            href={`/board/${boardId}`}
            className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
          >
            ← Back to board
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <BoardSettingsClient
          board={serialisedBoard}
          isOwner={isOwner}
        />
      </main>
    </div>
  );
}
