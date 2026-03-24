import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createListSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

type Params = { params: { boardId: string } };

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

    const { boardId } = params;

    const member = await isBoardMember(boardId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const lists = await prisma.list.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(lists);
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

    const { boardId } = params;

    const member = await isBoardMember(boardId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const aggregate = await prisma.list.aggregate({
      where: { boardId },
      _max: { position: true },
    });

    const maxPosition = aggregate._max.position ?? 0;
    const position = maxPosition + 1.0;

    const list = await prisma.list.create({
      data: {
        boardId,
        title: parsed.data.title,
        position,
      },
    });

    return NextResponse.json(list, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
