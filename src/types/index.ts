import type { Board, BoardMember, List, Card, Label, ChecklistItem, Comment, User } from "@prisma/client";

export type BoardWithMembers = Board & {
  owner: Pick<User, "id" | "email" | "name">;
  members: (BoardMember & {
    user: Pick<User, "id" | "email" | "name">;
  })[];
  _count?: { lists: number };
};

export type ListWithCards = List & {
  cards: CardWithLabels[];
};

export type CardWithLabels = Card & {
  labels: Label[];
  _count?: { checklistItems: number; comments: number };
};

export type CardDetail = Card & {
  labels: Label[];
  checklistItems: ChecklistItem[];
  comments: CommentWithAuthor[];
  list: Pick<List, "id" | "title">;
};

export type CommentWithAuthor = Comment & {
  author: Pick<User, "id" | "email" | "name">;
};

export type BoardPageData = Board & {
  lists: ListWithCards[];
  owner: Pick<User, "id" | "email" | "name">;
  members: (BoardMember & {
    user: Pick<User, "id" | "email" | "name">;
  })[];
};
