/** @jest-environment node */
import { PATCH, DELETE } from "@/app/api/boards/[boardId]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    board: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockFindFirst = prisma.board.findFirst as jest.Mock;
const mockUpdate = prisma.board.update as jest.Mock;
const mockDelete = prisma.board.delete as jest.Mock;

const SESSION = { user: { id: "user-1" } };
const PARAMS = { params: { boardId: "board-1" } };

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/boards/board-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq() {
  return new NextRequest("http://localhost/api/boards/board-1", {
    method: "DELETE",
  });
}

beforeEach(() => jest.clearAllMocks());

describe("PATCH /api/boards/[boardId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: "New" }), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when board is not found or user is not a member", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: "New" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is a member but not the owner", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "board-1", ownerId: "other-user" });
    const res = await PATCH(patchReq({ title: "New" }), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is empty", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "board-1", ownerId: "user-1" });
    const res = await PATCH(patchReq({ title: "" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 200 with updated board on success", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "board-1", ownerId: "user-1" });
    const updated = { id: "board-1", title: "Renamed", ownerId: "user-1", _count: { members: 0 } };
    mockUpdate.mockResolvedValue(updated);

    const res = await PATCH(patchReq({ title: "Renamed" }), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Renamed");
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "board-1", ownerId: "user-1" });
    mockUpdate.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(patchReq({ title: "Crash" }), PARAMS);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/boards/[boardId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when board is not found", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the owner", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "board-1", ownerId: "other-user" });
    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 204 on successful deletion", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "board-1", ownerId: "user-1" });
    mockDelete.mockResolvedValue({});

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "board-1" } });
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockFindFirst.mockResolvedValue({ id: "board-1", ownerId: "user-1" });
    mockDelete.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(deleteReq(), PARAMS);
    expect(res.status).toBe(500);
  });
});
