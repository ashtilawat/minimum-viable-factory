import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateListSchema } from "@/lib/validations";
import { getPositionAfter } from "@/lib/ordering";

async function verifyBoardAccess(boardId: string, userId: string) {
  return prisma.board.findFirst({
    where: {
      id: boardId,
      archived: false,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await verifyBoardAccess(params.boardId, session.user.id);
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const lists = await prisma.list.findMany({
    where: { boardId: params.boardId, archived: false },
    orderBy: { position: "asc" },
    include: {
      cards: {
        where: { archived: false },
        orderBy: { position: "asc" },
        include: { labels: true },
      },
    },
  });

  return NextResponse.json(lists);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { boardId: string } }
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
    const parsed = CreateListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    // Get the last list position
    const lastList = await prisma.list.findFirst({
      where: { boardId: params.boardId, archived: false },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = getPositionAfter(lastList?.position ?? null);

    const list = await prisma.list.create({
      data: {
        title: parsed.data.title,
        position,
        boardId: params.boardId,
      },
      include: {
        cards: true,
      },
    });

    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    console.error("Create list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
