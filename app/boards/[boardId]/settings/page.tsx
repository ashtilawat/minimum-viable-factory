import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Users } from "lucide-react";
import { InviteMemberForm } from "@/components/board/InviteMemberForm";

interface Props {
  params: { boardId: string };
}

export default async function BoardSettingsPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const board = await prisma.board.findFirst({
    where: {
      id: params.boardId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  if (!board) redirect("/boards");

  const isOwner = board.ownerId === session.user.id;

  return (
    <div className="flex h-full flex-col">
      <Header userEmail={session.user.email} userName={session.user.name} />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <Link
              href={`/boards/${params.boardId}`}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Back to board
            </Link>
          </div>
          <h1 className="mb-6 text-xl font-bold text-gray-800">Board Settings — {board.title}</h1>

          {/* Members Section */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center gap-2">
              <Users size={18} className="text-gray-600" />
              <h2 className="font-semibold text-gray-800">Members</h2>
            </div>

            {/* Owner */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Owner</p>
              <div className="flex items-center gap-3 rounded bg-gray-50 px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-trello-blue text-white text-sm flex items-center justify-center font-semibold">
                  {(board.owner.name ?? board.owner.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{board.owner.name ?? board.owner.email}</p>
                  <p className="text-xs text-gray-500">{board.owner.email}</p>
                </div>
              </div>
            </div>

            {/* Members list */}
            {board.members.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Members</p>
                <div className="space-y-2">
                  {board.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 rounded bg-gray-50 px-3 py-2">
                      <div className="h-8 w-8 rounded-full bg-gray-400 text-white text-sm flex items-center justify-center font-semibold">
                        {(member.user.name ?? member.user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{member.user.name ?? member.user.email}</p>
                        <p className="text-xs text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite form — only for owner */}
            {isOwner && (
              <InviteMemberForm boardId={params.boardId} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
