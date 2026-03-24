import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchListSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255).optional(),
    position: z.number().positive().optional(),
  })
  .refine((data) => data.title !== undefined || data.position !== undefined, {
    message: "At least one of title or position must be provided",
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

export async function PATCH(req: NextRequest, { params }: Params) {
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
    const parsed = patchListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.list.update({
      where: { id: listId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.position !== undefined && { position: parsed.data.position }),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
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

    await prisma.list.delete({ where: { id: listId } });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
