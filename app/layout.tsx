import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Trello Clone",
  description: "A self-hosted Kanban board application",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pass the server-side session to SessionProvider so clients don't need
  // an extra round-trip to fetch the session on first render.
  const session = await auth();

  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
