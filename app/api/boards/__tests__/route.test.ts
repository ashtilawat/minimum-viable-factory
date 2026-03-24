/** @jest-environment node */
import { GET, POST } from "@/app/api/boards/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.board.findMany as jest.Mock;
const mockCreate = prisma.board.create as jest.Mock;

function makeGetRequest() {
  return new NextRequest("http://localhost/api/boards");
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SESSION = { user: { id: "user-1", email: "user@example.com" } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/boards", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns the list of boards for the authenticated user", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const boards = [
      { id: "b1", title: "My Board", ownerId: "user-1", _count: { members: 0 } },
    ];
    mockFindMany.mockResolvedValue(boards);

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(boards);
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/boards", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest({ title: "New Board" }));
    expect(res.status).toBe(401);
  });

  it("creates a board and returns 201", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const board = { id: "b2", title: "New Board", ownerId: "user-1", _count: { members: 0 } };
    mockCreate.mockResolvedValue(board);

    const res = await POST(makePostRequest({ title: "New Board" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.title).toBe("New Board");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: "New Board", ownerId: "user-1" },
      })
    );
  });

  it("returns 400 when title is empty", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const res = await POST(makePostRequest({ title: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is missing", async () => {
    mockAuth.mockResolvedValue(SESSION);
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockCreate.mockRejectedValue(new Error("DB error"));

    const res = await POST(makePostRequest({ title: "Fail Board" }));
    expect(res.status).toBe(500);
  });
});
