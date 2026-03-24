"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface InviteMemberFormProps {
  boardId: string;
}

export function InviteMemberForm({ boardId }: InviteMemberFormProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/boards/${boardId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`${email} has been added to this board.`);
        setIsError(false);
        setEmail("");
      } else {
        setMessage(data.error ?? "Failed to invite member");
        setIsError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-200 pt-4">
      <p className="mb-3 text-sm font-semibold text-gray-700">Invite a member</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          required
          className="flex-1"
        />
        <Button type="submit" isLoading={isLoading}>
          <UserPlus size={14} className="mr-1" />
          Invite
        </Button>
      </form>
      {message && (
        <p className={["mt-2 text-sm", isError ? "text-red-600" : "text-green-600"].join(" ")}>
          {message}
        </p>
      )}
    </div>
  );
}
