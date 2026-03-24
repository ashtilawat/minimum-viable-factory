import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BoardView from "./BoardView";

interface PageProps {
  params: { boardId: string };
}

export default async function BoardPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { boardId } = params;
  const userId = session.user.id;

  // Fetch board and verify membership
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true, title: true, ownerId: true },
  });

  if (!board) {
    notFound();
  }

  // Fetch all lists with their cards
  const lists = await prisma.list.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    include: {
      cards: {
        orderBy: { position: "asc" },
        include: {
          labels: true,
        },
      },
    },
  });

  // Serialize dates to strings for client components
  const serializedLists = lists.map((list) => ({
    id: list.id,
    boardId: list.boardId,
    title: list.title,
    position: list.position,
    createdAt: list.createdAt.toISOString(),
    cards: list.cards.map((card) => ({
      id: card.id,
      listId: card.listId,
      title: card.title,
      description: card.description,
      dueDate: card.dueDate ? card.dueDate.toISOString() : null,
      position: card.position,
      createdAt: card.createdAt.toISOString(),
      labels: card.labels.map((label) => ({
        id: label.id,
        cardId: label.cardId,
        colour: label.colour,
        text: label.text,
      })),
    })),
  }));

  return (
    <div className="flex flex-col h-screen bg-blue-600">
      {/* Board Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-blue-700 bg-opacity-80">
        <h1 className="text-white font-bold text-lg">{board.title}</h1>
        <a
          href={`/board/${boardId}/settings`}
          className="text-white text-sm hover:underline opacity-80 hover:opacity-100"
        >
          Settings
        </a>
      </header>

      {/* Board View */}
      <main className="flex-1 overflow-hidden">
        <BoardView
          boardId={boardId}
          boardTitle={board.title}
          initialLists={serializedLists}
        />
      </main>
    </div>
  );
}
