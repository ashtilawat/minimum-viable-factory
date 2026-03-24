import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UpdateCardSchema } from "@/lib/validations";

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
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const card = await prisma.card.findFirst({
    where: {
      id: params.cardId,
      list: { boardId: params.boardId },
    },
    include: {
      labels: true,
      checklistItems: { orderBy: { position: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, email: true, name: true } } },
      },
      list: { select: { id: true, title: true } },
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  return NextResponse.json(card);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { boardId: string; cardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await verifyBoardAccess(params.boardId, session.user.id);
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { dueDate, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    const updated = await prisma.card.update({
      where: { id: params.cardId },
      data: updateData,
      include: {
        labels: true,
        checklistItems: { orderBy: { position: "asc" } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, email: true, name: true } } },
        },
        list: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update card error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
