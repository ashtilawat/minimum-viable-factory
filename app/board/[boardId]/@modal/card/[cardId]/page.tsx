import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CardDetail from "./CardDetail";

interface CardModalPageProps {
  params: {
    boardId: string;
    cardId: string;
  };
}

/**
 * Parallel-route server component for the card detail modal.
 *
 * Rendered in the @modal slot so the Kanban board remains visible behind the
 * overlay. The close button navigates back to the board page.
 */
export default async function CardModalPage({ params }: CardModalPageProps) {
  const { boardId, cardId } = params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  // Verify the user has access to this board
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: { id: true, title: true },
  });

  if (!board) notFound();

  // Fetch the card with labels and comments
  const card = await prisma.card.findFirst({
    where: {
      id: cardId,
      list: { boardId },
    },
    include: {
      labels: true,
      comments: {
        include: {
          author: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!card) notFound();

  // Serialise dates to strings for the client component
  const serialisedCard = {
    id: card.id,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate ? card.dueDate.toISOString() : null,
    listId: card.listId,
    labels: card.labels.map((l) => ({
      id: l.id,
      colour: l.colour,
      text: l.text,
    })),
    comments: card.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-10 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Card: ${card.title}`}
    >
      {/* Modal panel */}
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              {board.title}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-gray-900 leading-snug">
              {card.title}
            </h2>
          </div>

          {/* Close button — navigates back to the board */}
          <Link
            href={`/board/${boardId}`}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Close card detail"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </Link>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <CardDetail
            card={serialisedCard}
            boardId={boardId}
            currentUserId={session.user.id}
          />
        </div>
      </div>
    </div>
  );
}
