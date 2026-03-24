import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Server action: validate credentials via NextAuth and redirect on success.
 * On failure NextAuth itself redirects back here with ?error=CredentialsSignin
 * (configured in lib/auth.ts: pages.error = '/auth/login').
 */
async function loginAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/workspace",
    });
  } catch (error) {
    // AuthError means invalid credentials — redirect with a query-param flag.
    // Any other error (e.g. NEXT_REDIRECT) must be re-thrown so Next.js can
    // handle the successful redirect.
    if (error instanceof AuthError) {
      redirect("/auth/login?error=CredentialsSignin");
    }
    throw error;
  }
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; registered?: string };
}) {
  const errorMessage =
    searchParams.error === "CredentialsSignin"
      ? "Invalid email or password. Please try again."
      : searchParams.error
        ? "Something went wrong. Please try again."
        : null;

  const successMessage = searchParams.registered
    ? "Account created! Please sign in."
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600">Trello Clone</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        {/* Card */}
        <div className="rounded-lg bg-white px-6 py-8 shadow">
          {successMessage && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form action={loginAction} className="space-y-5">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email address"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            <Button type="submit" className="w-full" size="lg">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
