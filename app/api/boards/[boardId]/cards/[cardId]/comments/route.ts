import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateCommentSchema } from "@/lib/validations";

async function verifyBoardAccess(boardId: string, userId: string) {
  return prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { boardId: string; cardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await verifyBoardAccess(params.boardId, session.user.id);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const comments = await prisma.comment.findMany({
    where: { cardId: params.cardId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, email: true, name: true } } },
  });
  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { boardId: string; cardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await verifyBoardAccess(params.boardId, session.user.id);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = CreateCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const comment = await prisma.comment.create({
      data: {
        text: parsed.data.text,
        cardId: params.cardId,
        authorId: session.user.id,
      },
      include: { author: { select: { id: true, email: true, name: true } } },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
