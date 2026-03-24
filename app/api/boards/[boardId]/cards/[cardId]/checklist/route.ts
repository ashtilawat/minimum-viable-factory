import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateChecklistItemSchema, UpdateChecklistItemSchema } from "@/lib/validations";
import { getPositionAfter } from "@/lib/ordering";

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

  const items = await prisma.checklistItem.findMany({
    where: { cardId: params.cardId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json(items);
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
    const parsed = CreateChecklistItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const lastItem = await prisma.checklistItem.findFirst({
      where: { cardId: params.cardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = getPositionAfter(lastItem?.position ?? null);

    const item = await prisma.checklistItem.create({
      data: { text: parsed.data.text, position, cardId: params.cardId },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Create checklist item error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateChecklistItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const updated = await prisma.checklistItem.update({
      where: { id: itemId },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update checklist item error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { boardId: string; cardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await verifyBoardAccess(params.boardId, session.user.id);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  await prisma.checklistItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}
