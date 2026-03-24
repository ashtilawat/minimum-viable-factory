import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const labelSchema = z.object({
  colour: z.string().min(1),
  text: z.string().default(""),
});

const patchCardSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255).optional(),
    description: z.string().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    listId: z.string().optional(),
    position: z.number().positive().optional(),
    labels: z.array(labelSchema).optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.dueDate !== undefined ||
      data.listId !== undefined ||
      data.position !== undefined ||
      data.labels !== undefined,
    { message: "At least one field must be provided" }
  );

type Params = { params: { boardId: string; cardId: string } };

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

    const { boardId, cardId } = params;

    const member = await isBoardMember(boardId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify card belongs to this board (via list)
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        list: { boardId },
      },
      select: { id: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, description, dueDate, listId, position, labels } = parsed.data;

    // If labels are provided, replace them atomically in a transaction
    if (labels !== undefined) {
      const updated = await prisma.$transaction(async (tx) => {
        // Delete all existing labels for this card
        await tx.label.deleteMany({ where: { cardId } });

        // Insert the new labels
        if (labels.length > 0) {
          await tx.label.createMany({
            data: labels.map((l) => ({
              cardId,
              colour: l.colour,
              text: l.text,
            })),
          });
        }

        // Update the card's other fields
        return tx.card.update({
          where: { id: cardId },
          data: {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(dueDate !== undefined && {
              dueDate: dueDate !== null ? new Date(dueDate) : null,
            }),
            ...(listId !== undefined && { listId }),
            ...(position !== undefined && { position }),
          },
          include: { labels: true },
        });
      });

      return NextResponse.json(updated);
    }

    // No label changes — simple update
    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && {
          dueDate: dueDate !== null ? new Date(dueDate) : null,
        }),
        ...(listId !== undefined && { listId }),
        ...(position !== undefined && { position }),
      },
      include: { labels: true },
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

    const { boardId, cardId } = params;

    const member = await isBoardMember(boardId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify card belongs to this board (via list)
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        list: { boardId },
      },
      select: { id: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.card.delete({ where: { id: cardId } });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
