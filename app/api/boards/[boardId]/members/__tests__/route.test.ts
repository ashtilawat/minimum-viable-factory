/** @jest-environment node */
import { POST } from "@/app/api/boards/[boardId]/members/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    boardMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockBoardFindFirst = prisma.board.findFirst as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockBoardMemberFindUnique = prisma.boardMember.findUnique as jest.Mock;
const mockBoardMemberCreate = prisma.boardMember.create as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1" } };
const BOARD = { id: "board-1", ownerId: "user-1" };
const INVITEE = { id: "user-2", email: "bob@example.com", createdAt: new Date() };

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/boards/board-1/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("POST /api/boards/[boardId]/members", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(postReq({ email: "bob@example.com" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when board is not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(null);
    const res = await POST(postReq({ email: "bob@example.com" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 400 when email is invalid", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD);
    const res = await POST(postReq({ email: "not-an-email" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 404 when invitee user does not exist", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD);
    mockUserFindUnique.mockResolvedValue(null);
    const res = await POST(postReq({ email: "unknown@example.com" }), PARAMS);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/user not found/i);
  });

  it("returns 409 when user is already a member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD);
    mockUserFindUnique.mockResolvedValue(INVITEE);
    mockBoardMemberFindUnique.mockResolvedValue({ boardId: "board-1", userId: "user-2" });

    const res = await POST(postReq({ email: "bob@example.com" }), PARAMS);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already a member/i);
  });

  it("returns 409 when invitee is the board owner", async () => {
    mockAuth.mockResolvedValue(SESSION);
    // Board owner is user-2 (the invitee)
    mockBoardFindFirst.mockResolvedValue({ id: "board-1", ownerId: "user-2" });
    mockUserFindUnique.mockResolvedValue(INVITEE); // user-2
    mockBoardMemberFindUnique.mockResolvedValue(null); // not in members table

    const res = await POST(postReq({ email: "bob@example.com" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("creates membership and returns 201 on success", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD);
    mockUserFindUnique.mockResolvedValue(INVITEE);
    mockBoardMemberFindUnique.mockResolvedValue(null);
    const membership = {
      boardId: "board-1",
      userId: "user-2",
      joinedAt: new Date(),
      user: INVITEE,
    };
    mockBoardMemberCreate.mockResolvedValue(membership);

    const res = await POST(postReq({ email: "bob@example.com" }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.userId).toBe("user-2");
    expect(mockBoardMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { boardId: "board-1", userId: "user-2" },
      })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD);
    mockUserFindUnique.mockResolvedValue(INVITEE);
    mockBoardMemberFindUnique.mockResolvedValue(null);
    mockBoardMemberCreate.mockRejectedValue(new Error("DB error"));

    const res = await POST(postReq({ email: "bob@example.com" }), PARAMS);
    expect(res.status).toBe(500);
  });
});
