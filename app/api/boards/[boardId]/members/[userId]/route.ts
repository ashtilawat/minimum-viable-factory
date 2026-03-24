import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { boardId: string; userId: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { boardId, userId } = params;

    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    });
    if (!board) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (board.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (userId === board.ownerId) {
      return NextResponse.json(
        { error: "Cannot remove the board owner" },
        { status: 400 }
      );
    }

    const membership = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId } },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
