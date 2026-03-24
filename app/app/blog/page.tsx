import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — AI Software Factory",
  description:
    "Practical technical articles on agents, RAG systems, evals, context engineering, and production AI deployment.",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Blog</h1>
      <p className="mt-3 text-gray-500">
        Practical, example-driven content for engineers building AI-powered
        systems.
      </p>

      <div className="mt-10 divide-y divide-gray-100">
        {posts.map((post) => (
          <article key={post.slug} className="py-8">
            <time
              dateTime={post.date}
              className="text-sm text-gray-400 tabular-nums"
            >
              {new Date(post.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </time>
            <h2 className="mt-2 text-xl font-semibold text-gray-900">
              <Link
                href={`/blog/${post.slug}`}
                className="hover:text-gray-600 transition-colors"
              >
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 text-gray-600 leading-relaxed">{post.excerpt}</p>
            <div className="mt-4">
              <Link
                href={`/blog/${post.slug}`}
                className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors"
              >
                Read more →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
