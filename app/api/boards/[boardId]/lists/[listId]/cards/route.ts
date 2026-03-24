import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCardSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

type Params = { params: { boardId: string; listId: string } };

async function isBoardMember(boardId: string, userId: string): Promise<boolean> {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return board !== null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { boardId, listId } = params;

    const member = await isBoardMember(boardId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const list = await prisma.list.findFirst({
      where: { id: listId, boardId },
      select: { id: true },
    });
    if (!list) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const cards = await prisma.card.findMany({
      where: { listId },
      orderBy: { position: "asc" },
      include: {
        labels: true,
      },
    });

    return NextResponse.json(cards);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { boardId, listId } = params;

    const member = await isBoardMember(boardId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const list = await prisma.list.findFirst({
      where: { id: listId, boardId },
      select: { id: true },
    });
    if (!list) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const aggregate = await prisma.card.aggregate({
      where: { listId },
      _max: { position: true },
    });

    const maxPosition = aggregate._max.position ?? 0;
    const position = maxPosition + 1.0;

    const card = await prisma.card.create({
      data: {
        listId,
        title: parsed.data.title,
        position,
      },
      include: {
        labels: true,
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
