/** @jest-environment node */
import { DELETE } from "@/app/api/boards/[boardId]/members/[userId]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findFirst: jest.fn() },
    boardMember: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockBoardFindFirst = prisma.board.findFirst as jest.Mock;
const mockBoardMemberFindUnique = prisma.boardMember.findUnique as jest.Mock;
const mockBoardMemberDelete = prisma.boardMember.delete as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1", userId: "user-2" } };
const BOARD_OWNED_BY_USER1 = { id: "board-1", ownerId: "user-1" };
const MEMBERSHIP = { boardId: "board-1", userId: "user-2" };

function deleteReq() {
  return new NextRequest("http://localhost/api/boards/board-1/members/user-2", {
    method: "DELETE",
  });
}

beforeEach(() => jest.clearAllMocks());

describe("DELETE /api/boards/[boardId]/members/[userId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when board is not found or user is not a member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is a member but not the owner", async () => {
    mockAuth.mockResolvedValue(SESSION);
    // Board owned by someone else
    mockBoardFindFirst.mockResolvedValue({ id: "board-1", ownerId: "other-owner" });
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 400 when trying to remove the board owner", async () => {
    // userId == ownerId
    const params = { params: { boardId: "board-1", userId: "user-1" } };
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD_OWNED_BY_USER1);

    const req = new NextRequest("http://localhost/api/boards/board-1/members/user-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/cannot remove the board owner/i);
  });

  it("returns 404 when membership record does not exist", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD_OWNED_BY_USER1);
    mockBoardMemberFindUnique.mockResolvedValue(null);

    const res = await DELETE(deleteReq(), PARAMS);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/member not found/i);
  });

  it("returns 204 on successful removal", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD_OWNED_BY_USER1);
    mockBoardMemberFindUnique.mockResolvedValue(MEMBERSHIP);
    mockBoardMemberDelete.mockResolvedValue({});

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockBoardMemberDelete).toHaveBeenCalledWith({
      where: { boardId_userId: { boardId: "board-1", userId: "user-2" } },
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindFirst.mockResolvedValue(BOARD_OWNED_BY_USER1);
    mockBoardMemberFindUnique.mockResolvedValue(MEMBERSHIP);
    mockBoardMemberDelete.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(500);
  });
});
