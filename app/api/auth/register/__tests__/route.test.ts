/** @jest-environment node */
import { POST } from "@/app/api/auth/register/route";
import { NextResponse } from "next/server";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock bcrypt to avoid the expensive real hash in unit tests
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn(),
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  describe("happy path", () => {
    it("returns 201 with id and email on successful registration", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "user-123",
        email: "alice@example.com",
      });

      const res = await POST(makeRequest({ email: "Alice@Example.com", password: "password123" }));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body).toEqual({ id: "user-123", email: "alice@example.com" });
    });

    it("normalises email to lowercase before storing", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "u1", email: "bob@example.com" });

      await POST(makeRequest({ email: "BOB@EXAMPLE.COM", password: "secret1234" }));

      // findUnique should be called with the lowercased email
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: "bob@example.com" },
      });
    });
  });

  describe("validation errors (400)", () => {
    it("returns 400 for an invalid email", async () => {
      const res = await POST(makeRequest({ email: "not-an-email", password: "password123" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when password is shorter than 8 characters", async () => {
      const res = await POST(makeRequest({ email: "a@b.com", password: "short" }));
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toMatch(/8 characters/i);
    });

    it("returns 400 when password exceeds 128 characters", async () => {
      const longPassword = "a".repeat(129);
      const res = await POST(makeRequest({ email: "a@b.com", password: longPassword }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when the request body is missing required fields", async () => {
      const res = await POST(makeRequest({ email: "a@b.com" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for completely empty body", async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON body", async () => {
      const req = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid json/i);
    });
  });

  describe("conflict (409)", () => {
    it("returns 409 when the email is already registered", async () => {
      mockFindUnique.mockResolvedValue({ id: "existing", email: "alice@example.com" });

      const res = await POST(makeRequest({ email: "alice@example.com", password: "password123" }));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toMatch(/already exists/i);
    });

    it("does not call prisma.user.create when the email exists", async () => {
      mockFindUnique.mockResolvedValue({ id: "existing", email: "alice@example.com" });
      await POST(makeRequest({ email: "alice@example.com", password: "password123" }));
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("server error (500)", () => {
    it("returns 500 when prisma.user.create throws", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockRejectedValue(new Error("DB error"));

      const res = await POST(makeRequest({ email: "new@example.com", password: "password123" }));
      expect(res.status).toBe(500);
    });
  });
});
