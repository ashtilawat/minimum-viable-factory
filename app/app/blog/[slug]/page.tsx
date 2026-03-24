import { getAllPosts, getPostBySlug } from "@/lib/posts";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface PageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const posts = getAllPosts();
  const match = posts.find((p) => p.slug === params.slug);
  if (!match) return {};
  return {
    title: `${match.title} — AI Software Factory`,
    description: match.excerpt,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const posts = getAllPosts();
  const exists = posts.some((p) => p.slug === params.slug);
  if (!exists) notFound();

  const post = await getPostBySlug(params.slug);

  return (
    <article>
      <header className="mb-10">
        <time
          dateTime={post.meta.date}
          className="text-sm text-gray-400 tabular-nums"
        >
          {new Date(post.meta.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}
        </time>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {post.meta.title}
        </h1>
        <p className="mt-4 text-lg text-gray-600">{post.meta.excerpt}</p>
      </header>

      <div
        className="prose prose-gray max-w-none prose-code:before:content-none prose-code:after:content-none"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </article>
  );
}
