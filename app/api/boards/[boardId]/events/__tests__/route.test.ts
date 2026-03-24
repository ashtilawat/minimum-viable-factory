/** @jest-environment node */
import { GET } from "@/app/api/boards/[boardId]/events/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/sse", () => ({
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockBoardFindUnique = prisma.board.findUnique as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1" } };

function getReq() {
  return new NextRequest("http://localhost/api/boards/board-1/events");
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/boards/[boardId]/events (SSE)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when board is not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue(null);
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is neither owner nor member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue({
      id: "board-1",
      ownerId: "other-owner",
      members: [], // user-1 is NOT a member
    });
    const res = await GET(getReq(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns a streaming SSE response for the board owner", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue({
      id: "board-1",
      ownerId: "user-1",
      members: [],
    });

    const res = await GET(getReq(), PARAMS);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("returns a streaming SSE response for a board member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue({
      id: "board-1",
      ownerId: "other-owner",
      members: [{ userId: "user-1" }],
    });

    const res = await GET(getReq(), PARAMS);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("sends an initial CONNECTED event in the stream", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockBoardFindUnique.mockResolvedValue({
      id: "board-1",
      ownerId: "user-1",
      members: [],
    });

    const res = await GET(getReq(), PARAMS);

    // Read the first chunk from the stream
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);

    expect(text).toBe(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`);
    reader.cancel();
  });
});
