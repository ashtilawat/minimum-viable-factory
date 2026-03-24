import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InviteMemberSchema } from "@/lib/validations";

export async function POST(
  req: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findFirst({
    where: { id: params.boardId, ownerId: session.user.id },
  });
  if (!board) {
    return NextResponse.json({ error: "Board not found or not owner" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = InviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, name: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === session.user.id) {
      return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
    }

    const existing = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId: params.boardId, userId: targetUser.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const member = await prisma.boardMember.create({
      data: { boardId: params.boardId, userId: targetUser.id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findFirst({
    where: {
      id: params.boardId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
  });
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const members = await prisma.boardMember.findMany({
    where: { boardId: params.boardId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json(members);
}
