/** @jest-environment node */
import { GET, POST } from "@/app/api/boards/[boardId]/lists/[listId]/cards/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findFirst: jest.fn() },
    list: { findFirst: jest.fn() },
    card: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockBoardFindFirst = prisma.board.findFirst as jest.Mock;
const mockListFindFirst = prisma.list.findFirst as jest.Mock;
const mockCardFindMany = prisma.card.findMany as jest.Mock;
const mockCardAggregate = prisma.card.aggregate as jest.Mock;
const mockCardCreate = prisma.card.create as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1", listId: "list-1" } };

function getReq() {
  return new NextRequest("http://localhost/api/boards/board-1/lists/list-1/cards");
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/boards/board-1/lists/list-1/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/boards/[boardId]/lists/[listId]/cards", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not a board member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 404 when list does not belong to the board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns cards ordered by position with labels", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    const cards = [
      { id: "c1", title: "Task 1", position: 1, labels: [] },
      { id: "c2", title: "Task 2", position: 2, labels: [{ colour: "#ff0000" }] },
    ];
    mockCardFindMany.mockResolvedValue(cards);

    const res = await GET(getReq(), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(cards);
    expect(mockCardFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { position: "asc" } })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    mockCardFindMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/boards/[boardId]/lists/[listId]/cards", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(postReq({ title: "Card" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not a board member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(null);
    const res = await POST(postReq({ title: "Card" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 404 when list does not belong to the board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue(null);
    const res = await POST(postReq({ title: "Card" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 400 when title is empty", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    const res = await POST(postReq({ title: "" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("creates card at maxPosition + 1 and returns 201", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    mockCardAggregate.mockResolvedValue({ _max: { position: 3 } });
    const card = { id: "c3", title: "New Card", position: 4, listId: "list-1", labels: [] };
    mockCardCreate.mockResolvedValue(card);

    const res = await POST(postReq({ title: "New Card" }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.position).toBe(4);
  });

  it("creates card at position 1.0 when no cards exist yet", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    mockCardAggregate.mockResolvedValue({ _max: { position: null } });
    mockCardCreate.mockResolvedValue({ id: "c1", title: "First", position: 1, labels: [] });

    await POST(postReq({ title: "First" }), PARAMS);

    expect(mockCardCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 1 }),
      })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindFirst.mockResolvedValue({ id: "list-1" });
    mockCardAggregate.mockResolvedValue({ _max: { position: 0 } });
    mockCardCreate.mockRejectedValue(new Error("DB error"));

    const res = await POST(postReq({ title: "Fail" }), PARAMS);
    expect(res.status).toBe(500);
  });
});
