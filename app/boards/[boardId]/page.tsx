import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { BoardHeader } from "@/components/layout/BoardHeader";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import type { BoardPageData } from "@/types";

interface Props {
  params: { boardId: string };
}

export default async function BoardPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const board = await prisma.board.findFirst({
    where: {
      id: params.boardId,
      archived: false,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
      lists: {
        where: { archived: false },
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: { archived: false },
            orderBy: { position: "asc" },
            include: {
              labels: true,
              _count: { select: { checklistItems: true, comments: true } },
            },
          },
        },
      },
    },
  });

  if (!board) redirect("/boards");

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: board.bgColor }}>
      <Header userEmail={session.user.email} userName={session.user.name} />
      <BoardHeader
        boardId={board.id}
        title={board.title}
        bgColor={board.bgColor}
      />
      <div className="flex-1 overflow-hidden">
        <BoardCanvas
          initialBoard={board as unknown as BoardPageData}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
