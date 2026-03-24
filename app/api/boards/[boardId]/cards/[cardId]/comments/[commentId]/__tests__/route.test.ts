/** @jest-environment node */
import { DELETE } from "@/app/api/boards/[boardId]/cards/[cardId]/comments/[commentId]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findUnique: jest.fn() },
    comment: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));
jest.mock("@/lib/sse", () => ({ broadcast: jest.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";

const mockAuth = auth as jest.Mock;
const mockBoardFindUnique = prisma.board.findUnique as jest.Mock;
const mockCommentFindUnique = prisma.comment.findUnique as jest.Mock;
const mockCommentDelete = prisma.comment.delete as jest.Mock;
const mockBroadcast = broadcast as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = {
  params: { boardId: "board-1", cardId: "card-1", commentId: "comment-1" },
};

const BOARD = { id: "board-1", ownerId: "owner-1" };
const COMMENT = {
  id: "comment-1",
  cardId: "card-1",
  authorId: "user-1",
  card: { list: { boardId: "board-1" } },
};

function deleteReq() {
  return new NextRequest(
    "http://localhost/api/boards/board-1/cards/card-1/comments/comment-1",
    { method: "DELETE" }
  );
}

beforeEach(() => jest.clearAllMocks());

describe("DELETE /api/boards/.../comments/[commentId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when board is not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 404 when comment is not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD);
    mockCommentFindUnique.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 404 when comment belongs to a different card", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD);
    mockCommentFindUnique.mockResolvedValue({
      ...COMMENT,
      cardId: "other-card",
    });
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is neither the board owner nor the comment author", async () => {
    mockAuth.mockResolvedValue({ user: { id: "outsider" } });
    mockBoardFindUnique.mockResolvedValue(BOARD); // ownerId: owner-1, not outsider
    mockCommentFindUnique.mockResolvedValue({
      ...COMMENT,
      authorId: "user-1", // also not outsider
    });
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("allows comment author to delete their own comment", async () => {
    // user-1 is the author (not the board owner)
    mockAuth.mockResolvedValue(SESSION); // user-1
    mockBoardFindUnique.mockResolvedValue(BOARD); // ownerId: owner-1
    mockCommentFindUnique.mockResolvedValue(COMMENT); // authorId: user-1
    mockCommentDelete.mockResolvedValue({});

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockCommentDelete).toHaveBeenCalledWith({
      where: { id: "comment-1" },
    });
  });

  it("allows board owner to delete any comment", async () => {
    // owner-1 is the board owner
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockBoardFindUnique.mockResolvedValue(BOARD); // ownerId: owner-1
    mockCommentFindUnique.mockResolvedValue({
      ...COMMENT,
      authorId: "someone-else",
    });
    mockCommentDelete.mockResolvedValue({});

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(204);
  });

  it("broadcasts COMMENT_DELETED event after deletion", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD);
    mockCommentFindUnique.mockResolvedValue(COMMENT);
    mockCommentDelete.mockResolvedValue({});

    await DELETE(deleteReq(), PARAMS);

    expect(mockBroadcast).toHaveBeenCalledWith("board-1", {
      type: "COMMENT_DELETED",
      commentId: "comment-1",
      cardId: "card-1",
    });
  });

  it("propagates unexpected errors (no try/catch wrapper in this route)", async () => {
    // The DELETE comment route does not wrap in try/catch, so DB errors bubble up.
    // This test documents the expected behavior: the route throws rather than
    // returning a 500, meaning the caller (Next.js error boundary) handles it.
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(BOARD);
    mockCommentFindUnique.mockResolvedValue(COMMENT);
    mockCommentDelete.mockRejectedValue(new Error("DB error"));

    await expect(DELETE(deleteReq(), PARAMS)).rejects.toThrow("DB error");
  });
});
