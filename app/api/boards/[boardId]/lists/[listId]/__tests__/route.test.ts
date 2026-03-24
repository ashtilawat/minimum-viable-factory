/** @jest-environment node */
import { PATCH, DELETE } from "@/app/api/boards/[boardId]/lists/[listId]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findFirst: jest.fn() },
    list: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockBoardFindFirst = prisma.board.findFirst as jest.Mock;
const mockListFindFirst = prisma.list.findFirst as jest.Mock;
const mockListUpdate = prisma.list.update as jest.Mock;
const mockListDelete = prisma.list.delete as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1", listId: "list-1" } };

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/boards/board-1/lists/list-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq() {
  return new NextRequest("http://localhost/api/boards/board-1/lists/list-1", {
    method: "DELETE",
  });
}

beforeEach(() => jest.clearAllMocks());

describe("PATCH /api/boards/[boardId]/lists/[listId]", () => {
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

  it("returns 404 when list does not belong to the board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: "New" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 400 when neither title nor position is provided", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    const res = await PATCH(patchReq({}), PARAMS);
    expect(res.status).toBe(400);
  });

  it("renames a list successfully", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    const updated = { id: "list-1", title: "Renamed", position: 1 };
    mockListUpdate.mockResolvedValue(updated);

    const res = await PATCH(patchReq({ title: "Renamed" }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Renamed");
  });

  it("reorders a list by updating its position", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    const updated = { id: "list-1", title: "Todo", position: 1.5 };
    mockListUpdate.mockResolvedValue(updated);

    const res = await PATCH(patchReq({ position: 1.5 }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.position).toBe(1.5);
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    mockListUpdate.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(patchReq({ title: "Crash" }), PARAMS);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/boards/[boardId]/lists/[listId]", () => {
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

  it("returns 404 when list does not belong to the board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 204 on successful deletion", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    mockListDelete.mockResolvedValue({});

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockListDelete).toHaveBeenCalledWith({ where: { id: "list-1" } });
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    mockListDelete.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(500);
  });
});
