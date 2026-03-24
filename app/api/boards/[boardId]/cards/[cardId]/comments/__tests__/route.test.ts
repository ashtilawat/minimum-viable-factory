/** @jest-environment node */
import { GET, POST } from "@/app/api/boards/[boardId]/cards/[cardId]/comments/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findUnique: jest.fn() },
    card: { findFirst: jest.fn() },
    comment: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));
jest.mock("@/lib/sse", () => ({ broadcast: jest.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";

const mockAuth = auth as jest.Mock;
const mockBoardFindUnique = prisma.board.findUnique as jest.Mock;
const mockCardFindFirst = prisma.card.findFirst as jest.Mock;
const mockCommentFindMany = prisma.comment.findMany as jest.Mock;
const mockCommentCreate = prisma.comment.create as jest.Mock;
const mockBroadcast = broadcast as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1", cardId: "card-1" } };

// A board where user-1 is the owner
const BOARD_OWNER = {
  id: "board-1",
  ownerId: "user-1",
  members: [],
};

// A board where user-1 is a member (not owner)
const BOARD_MEMBER = {
  id: "board-1",
  ownerId: "other-user",
  members: [{ userId: "user-1" }],
};

const CARD = { id: "card-1", listId: "list-1" };

function getReq() {
  return new NextRequest("http://localhost/api/boards/board-1/cards/card-1/comments");
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/boards/board-1/cards/card-1/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/boards/.../comments", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no access to the board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is neither owner nor member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue({
      id: "board-1",
      ownerId: "other-user",
      members: [], // user-1 is NOT a member
    });
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 404 when card is not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_OWNER);
    mockCardFindFirst.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns comments for the card as owner", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_OWNER);
    mockCardFindFirst.mockResolvedValue(CARD);
    const comments = [
      { id: "cm1", body: "Hello", author: { id: "user-1", email: "u@e.com" }, createdAt: new Date() },
    ];
    mockCommentFindMany.mockResolvedValue(comments);

    const res = await GET(getReq(), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].body).toBe("Hello");
  });

  it("returns comments for the card as a board member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_MEMBER);
    mockCardFindFirst.mockResolvedValue(CARD);
    mockCommentFindMany.mockResolvedValue([]);

    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/boards/.../comments", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(postReq({ body: "Hi" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no access to the board", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(null);
    const res = await POST(postReq({ body: "Hi" }), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 404 when card is not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_OWNER);
    mockCardFindFirst.mockResolvedValue(null);
    const res = await POST(postReq({ body: "Hi" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 422 when comment body is empty", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_OWNER);
    mockCardFindFirst.mockResolvedValue(CARD);
    const res = await POST(postReq({ body: "" }), PARAMS);
    expect(res.status).toBe(422);
  });

  it("returns 400 for invalid JSON", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_OWNER);
    mockCardFindFirst.mockResolvedValue(CARD);
    const req = new NextRequest("http://localhost/api/boards/board-1/cards/card-1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it("creates a comment and returns 201", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_OWNER);
    mockCardFindFirst.mockResolvedValue(CARD);
    const comment = {
      id: "cm1",
      body: "Great task!",
      cardId: "card-1",
      authorId: "user-1",
      author: { id: "user-1", email: "u@e.com" },
      createdAt: new Date(),
    };
    mockCommentCreate.mockResolvedValue(comment);

    const res = await POST(postReq({ body: "Great task!" }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.body).toBe("Great task!");
  });

  it("broadcasts a COMMENT_CREATED event after creation", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD_OWNER);
    mockCardFindFirst.mockResolvedValue(CARD);
    const comment = {
      id: "cm2",
      body: "SSE test",
      cardId: "card-1",
      authorId: "user-1",
      author: { id: "user-1", email: "u@e.com" },
    };
    mockCommentCreate.mockResolvedValue(comment);

    await POST(postReq({ body: "SSE test" }), PARAMS);

    expect(mockBroadcast).toHaveBeenCalledWith("board-1", {
      type: "COMMENT_CREATED",
      comment,
    });
  });
});
