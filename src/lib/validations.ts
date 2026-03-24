import { z } from "zod";

export const CreateBoardSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color").default("#0079BF"),
});

export const UpdateBoardSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  archived: z.boolean().optional(),
});

export const CreateListSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
});

export const UpdateListSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  position: z.string().optional(),
  archived: z.boolean().optional(),
});

export const CreateCardSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  listId: z.string().min(1),
});

export const UpdateCardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  position: z.string().optional(),
  listId: z.string().optional(),
  archived: z.boolean().optional(),
});

export const CreateCommentSchema = z.object({
  text: z.string().min(1, "Comment cannot be empty").max(2000),
});

export const InviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const CreateLabelSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color"),
  text: z.string().max(50).optional(),
});

export const CreateChecklistItemSchema = z.object({
  text: z.string().min(1, "Item text is required").max(200),
});

export const UpdateChecklistItemSchema = z.object({
  completed: z.boolean().optional(),
  text: z.string().min(1).max(200).optional(),
});

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100).optional(),
});
