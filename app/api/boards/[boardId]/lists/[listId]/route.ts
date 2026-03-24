import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UpdateListSchema } from "@/lib/validations";

async function verifyBoardAccess(boardId: string, userId: string) {
  return prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { boardId: string; listId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await verifyBoardAccess(params.boardId, session.user.id);
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const list = await prisma.list.findFirst({
    where: { id: params.listId, boardId: params.boardId },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const updated = await prisma.list.update({
      where: { id: params.listId },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { boardId: string; listId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await verifyBoardAccess(params.boardId, session.user.id);
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  await prisma.list.update({
    where: { id: params.listId },
    data: { archived: true },
  });

  return NextResponse.json({ success: true });
}
