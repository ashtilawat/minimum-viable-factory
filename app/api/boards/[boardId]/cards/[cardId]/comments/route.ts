import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";

const createCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
});

async function getBoardMembership(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      members: { where: { userId } },
    },
  });
  if (!board) return null;
  const isOwner = board.ownerId === userId;
  const isMember = board.members.length > 0;
  if (!isOwner && !isMember) return null;
  return { board, isOwner };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { boardId: string; cardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardId, cardId } = params;

  const membership = await getBoardMembership(boardId, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const card = await prisma.card.findFirst({
    where: {
      id: cardId,
      list: { boardId },
    },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { cardId },
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: { id: true, email: true },
      },
    },
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

  const { boardId, cardId } = params;

  const membership = await getBoardMembership(boardId, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const card = await prisma.card.findFirst({
    where: {
      id: cardId,
      list: { boardId },
    },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      cardId,
      authorId: session.user.id,
      body: parsed.data.body,
    },
    include: {
      author: {
        select: { id: true, email: true },
      },
    },
  });

  broadcast(boardId, { type: "COMMENT_CREATED", comment });

  return NextResponse.json(comment, { status: 201 });
}
