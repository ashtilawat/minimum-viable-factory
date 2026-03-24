import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateCardSchema } from "@/lib/validations";
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

  const cards = await prisma.card.findMany({
    where: { listId: params.listId, archived: false },
    orderBy: { position: "asc" },
    include: { labels: true },
  });

  return NextResponse.json(cards);
}

export async function POST(
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
    where: { id: params.listId, boardId: params.boardId, archived: false },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const cardData = { title: body.title, listId: params.listId };
    const parsed = CreateCardSchema.safeParse(cardData);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const lastCard = await prisma.card.findFirst({
      where: { listId: params.listId, archived: false },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = getPositionAfter(lastCard?.position ?? null);

    const card = await prisma.card.create({
      data: {
        title: parsed.data.title,
        position,
        listId: params.listId,
      },
      include: { labels: true },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Create card error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
