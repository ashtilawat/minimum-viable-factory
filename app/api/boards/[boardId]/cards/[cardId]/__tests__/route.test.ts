/** @jest-environment node */
import { PATCH, DELETE } from "@/app/api/boards/[boardId]/cards/[cardId]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findFirst: jest.fn() },
    card: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    label: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockBoardFindFirst = prisma.board.findFirst as jest.Mock;
const mockCardFindFirst = prisma.card.findFirst as jest.Mock;
const mockCardUpdate = prisma.card.update as jest.Mock;
const mockCardDelete = prisma.card.delete as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1", cardId: "card-1" } };

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/boards/board-1/cards/card-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq() {
  return new NextRequest("http://localhost/api/boards/board-1/cards/card-1", {
    method: "DELETE",
  });
}

beforeEach(() => jest.clearAllMocks());

describe("PATCH /api/boards/[boardId]/cards/[cardId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: "New" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not a board member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: "New" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 404 when card does not belong to this board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: "New" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 400 when no fields are provided", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    const res = await PATCH(patchReq({}), PARAMS);
    expect(res.status).toBe(400);
  });

  it("updates the card title and returns 200", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    const updated = { id: "card-1", title: "Updated", labels: [] };
    mockCardUpdate.mockResolvedValue(updated);

    const res = await PATCH(patchReq({ title: "Updated" }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Updated");
  });

  it("moves a card to a different list", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    const updated = { id: "card-1", title: "Task", listId: "list-2", position: 1.5, labels: [] };
    mockCardUpdate.mockResolvedValue(updated);

    const res = await PATCH(patchReq({ listId: "list-2", position: 1.5 }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.listId).toBe("list-2");
    expect(body.position).toBe(1.5);
  });

  it("replaces labels atomically in a transaction when labels are provided", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    const updatedCard = {
      id: "card-1",
      title: "Labeled",
      labels: [{ colour: "#ff0000", text: "Bug" }],
    };
    mockTransaction.mockImplementation(async (fn: Function) => fn({
      label: { deleteMany: jest.fn(), createMany: jest.fn() },
      card: { update: jest.fn().mockResolvedValue(updatedCard) },
    }));

    const res = await PATCH(
      patchReq({ labels: [{ colour: "#ff0000", text: "Bug" }] }),
      PARAMS
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();
    expect(body.labels[0].colour).toBe("#ff0000");
  });

  it("clears all labels when an empty labels array is provided", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });

    const updatedCard = { id: "card-1", title: "No Labels", labels: [] };
    const txMockDeleteMany = jest.fn();
    const txMockCreateMany = jest.fn();
    const txMockCardUpdate = jest.fn().mockResolvedValue(updatedCard);

    mockTransaction.mockImplementation(async (fn: Function) =>
      fn({
        label: { deleteMany: txMockDeleteMany, createMany: txMockCreateMany },
        card: { update: txMockCardUpdate },
      })
    );

    const res = await PATCH(patchReq({ labels: [] }), PARAMS);
    expect(res.status).toBe(200);
    expect(txMockDeleteMany).toHaveBeenCalledWith({ where: { cardId: "card-1" } });
    // createMany should NOT be called when labels array is empty
    expect(txMockCreateMany).not.toHaveBeenCalled();
  });

  it("updates description to null (clear description)", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    mockCardUpdate.mockResolvedValue({ id: "card-1", description: null, labels: [] });

    const res = await PATCH(patchReq({ description: null }), PARAMS);
    expect(res.status).toBe(200);
    expect(mockCardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: null }),
      })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    mockCardUpdate.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(patchReq({ title: "Crash" }), PARAMS);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/boards/[boardId]/cards/[cardId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not a board member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 404 when card does not belong to this board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 204 on successful deletion", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    mockCardDelete.mockResolvedValue({});

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockCardDelete).toHaveBeenCalledWith({ where: { id: "card-1" } });
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockCardFindFirst.mockResolvedValue({ id: "card-1" });
    mockCardDelete.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(500);
  });
});
