import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { Plus } from "lucide-react";

export default async function BoardsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const boards = await prisma.board.findMany({
    where: {
      archived: false,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      _count: { select: { lists: true } },
    },
  });

  return (
    <div className="flex h-full flex-col">
      <Header userEmail={session.user.email} userName={session.user.name} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Your Boards</h2>
            <Link
              href="/boards/new"
              className="flex items-center gap-1 rounded bg-trello-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-trello-blue-dark"
            >
              <Plus size={14} />
              Create board
            </Link>
          </div>
          {boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16">
              <p className="text-gray-500 mb-3">No boards yet</p>
              <Link
                href="/boards/new"
                className="rounded bg-trello-blue px-4 py-2 text-sm font-medium text-white hover:bg-trello-blue-dark"
              >
                Create your first board
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/boards/${board.id}`}
                  className="group relative flex h-28 flex-col justify-between rounded-lg p-4 text-white shadow hover:shadow-md transition-shadow overflow-hidden"
                  style={{ backgroundColor: board.bgColor }}
                >
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                    {board.title}
                  </h3>
                  <p className="text-xs opacity-80">
                    {board._count.lists} list{board._count.lists !== 1 ? "s" : ""}
                  </p>
                  {board.ownerId !== session.user!.id && (
                    <span className="absolute top-2 right-2 rounded bg-black/20 px-1.5 py-0.5 text-xs">
                      Member
                    </span>
                  )}
                </Link>
              ))}
              <Link
                href="/boards/new"
                className="flex h-28 items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors text-gray-600"
              >
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Plus size={16} />
                  Create new board
                </div>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
