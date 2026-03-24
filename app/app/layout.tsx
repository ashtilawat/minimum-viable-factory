import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "AI Software Factory",
  description:
    "Practical technical content for engineers building AI-powered software factories.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <NavBar />
        <main className="mx-auto max-w-4xl px-4 py-12">{children}</main>
      </body>
    </html>
  );
}
