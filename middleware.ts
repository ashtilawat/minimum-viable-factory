import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * NextAuth v5 middleware — runs on every request matched by `config.matcher`.
 *
 * If the incoming request does not have a valid session the user is redirected
 * to the sign-in page.  The original destination URL is forwarded as the
 * `callbackUrl` query parameter so NextAuth can redirect back after a
 * successful login.
 */
export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL('/auth/login', req.url)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
})

export const config = {
  /*
   * Protect every page under /board and /workspace.
   * Explicitly exclude:
   *   - NextAuth API routes  (/api/auth/*)
   *   - Registration API     (/api/auth/register)
   *   - Static assets        (_next/static, _next/image, favicon.ico)
   *   - Auth UI pages        (/auth/*)
   */
  matcher: ['/board/:path*', '/workspace/:path*'],
}
