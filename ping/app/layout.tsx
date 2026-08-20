import type { Metadata } from "next";
import { puzzleNumber, todayUtcDate } from "../lib/epoch";
import "./globals.css";

export const dynamic = "force-dynamic";

const utcDate = todayUtcDate();
const title = `PING #${puzzleNumber(utcDate)}`;

export const metadata: Metadata = {
  title,
  description: "Find the hidden cell in four taps.",
  openGraph: {
    title,
    description: "Find the hidden cell in four taps.",
    url: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
