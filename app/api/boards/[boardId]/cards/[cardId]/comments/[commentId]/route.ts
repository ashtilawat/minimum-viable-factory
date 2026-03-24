import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { boardId: string; cardId: string; commentId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardId, cardId, commentId } = params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
  });
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      card: {
        include: { list: true },
      },
    },
  });

  if (!comment || comment.cardId !== cardId || comment.card.list.boardId !== boardId) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isOwner = board.ownerId === session.user.id;
  const isAuthor = comment.authorId === session.user.id;

  if (!isOwner && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: commentId } });

  broadcast(boardId, { type: "COMMENT_DELETED", commentId, cardId });

  return new NextResponse(null, { status: 204 });
}
