import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribe, unsubscribe } from "@/lib/sse";

export async function GET(
  _req: NextRequest,
  { params }: { params: { boardId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      members: { where: { userId: session.user.id } },
    },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const isOwner = board.ownerId === session.user.id;
  const isMember = board.members.length > 0;

  if (!isOwner && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const encoder = new TextEncoder();

  let streamController: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      subscribe(boardId, controller);
      // Send an initial ping to confirm connection
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`)
      );
    },
    cancel() {
      unsubscribe(boardId, streamController);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
