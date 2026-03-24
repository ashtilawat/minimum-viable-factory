/** @jest-environment node */
import { GET, POST } from "@/app/api/boards/[boardId]/lists/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findFirst: jest.fn() },
    list: {
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
const mockListFindMany = prisma.list.findMany as jest.Mock;
const mockListAggregate = prisma.list.aggregate as jest.Mock;
const mockListCreate = prisma.list.create as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1" } };

function getReq() {
  return new NextRequest("http://localhost/api/boards/board-1/lists");
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/boards/board-1/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/boards/[boardId]/lists", () => {
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

  it("returns lists ordered by position", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    const lists = [
      { id: "l1", title: "Todo", position: 1, boardId: "board-1" },
      { id: "l2", title: "Done", position: 2, boardId: "board-1" },
    ];
    mockListFindMany.mockResolvedValue(lists);

    const res = await GET(getReq(), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(lists);
    expect(mockListFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { position: "asc" } })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListFindMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/boards/[boardId]/lists", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(postReq({ title: "New List" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user is not a board member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(null);
    const res = await POST(postReq({ title: "New List" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 400 when title is empty", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    const res = await POST(postReq({ title: "" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("creates list at position maxPosition + 1 and returns 201", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListAggregate.mockResolvedValue({ _max: { position: 2 } });
    const created = { id: "l3", title: "New List", position: 3, boardId: "board-1" };
    mockListCreate.mockResolvedValue(created);

    const res = await POST(postReq({ title: "New List" }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.position).toBe(3);
    expect(mockListCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 3, title: "New List" }),
      })
    );
  });

  it("creates list at position 1.0 when no lists exist yet", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListAggregate.mockResolvedValue({ _max: { position: null } });
    mockListCreate.mockResolvedValue({ id: "l1", title: "First", position: 1, boardId: "board-1" });

    await POST(postReq({ title: "First" }), PARAMS);

    expect(mockListCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 1 }),
      })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue({ id: "board-1" });
    mockListAggregate.mockResolvedValue({ _max: { position: 0 } });
    mockListCreate.mockRejectedValue(new Error("DB error"));

    const res = await POST(postReq({ title: "Fail" }), PARAMS);
    expect(res.status).toBe(500);
  });
});
