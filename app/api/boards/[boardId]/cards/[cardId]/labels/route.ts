import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateLabelSchema } from "@/lib/validations";

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

  const labels = await prisma.label.findMany({ where: { cardId: params.cardId } });
  return NextResponse.json(labels);
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
    const parsed = CreateLabelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const label = await prisma.label.create({
      data: { color: parsed.data.color, text: parsed.data.text ?? null, cardId: params.cardId },
    });
    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    console.error("Create label error:", error);
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
  const labelId = searchParams.get("labelId");
  if (!labelId) {
    return NextResponse.json({ error: "labelId is required" }, { status: 400 });
  }

  await prisma.label.delete({ where: { id: labelId } });
  return NextResponse.json({ success: true });
}
