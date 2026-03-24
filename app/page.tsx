import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Root page: redirect authenticated users to their workspace,
 * and unauthenticated users to the login page.
 */
export default async function RootPage() {
  const session = await auth();

  if (session) {
    redirect("/workspace");
  } else {
    redirect("/auth/login");
  }
}
