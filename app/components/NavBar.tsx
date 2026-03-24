import Link from "next/link";

export default function NavBar() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold text-gray-900 hover:text-gray-600 transition-colors"
        >
          AI Software Factory
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/blog"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Blog
          </Link>
        </div>
      </nav>
    </header>
  );
}
