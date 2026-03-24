import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type Params = { params: { boardId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { boardId } = params;

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

    // Only the board owner can invite new members
    if (board.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const invitee = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, createdAt: true },
    });
    if (!invitee) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already a member or owner
    const existing = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: invitee.id } },
    });
    if (existing || invitee.id === board.ownerId) {
      return NextResponse.json(
        { error: "User is already a member of this board" },
        { status: 409 }
      );
    }

    const membership = await prisma.boardMember.create({
      data: { boardId, userId: invitee.id },
      include: {
        user: {
          select: { id: true, email: true, createdAt: true },
        },
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
