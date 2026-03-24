import Link from "next/link";

export default function HomePage() {
  return (
    <div className="py-16">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        AI Software Factory
      </h1>
      <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl">
        Practical, example-driven content for engineers building and operating
        AI-powered software factories — agents, RAG systems, evals, context
        engineering, and production AI deployment.
      </p>
      <div className="mt-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
        >
          Read the blog →
        </Link>
      </div>
    </div>
  );
}
