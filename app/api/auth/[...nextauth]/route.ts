import { handlers } from '@/lib/auth'

/**
 * Delegate all NextAuth HTTP traffic (GET + POST) to the NextAuth handler
 * exported from the central auth configuration module.
 *
 * Handles:
 *   GET  /api/auth/session
 *   GET  /api/auth/csrf
 *   GET  /api/auth/providers
 *   GET  /api/auth/signin
 *   GET  /api/auth/signout
 *   GET  /api/auth/callback/:provider
 *   POST /api/auth/signin/:provider
 *   POST /api/auth/signout
 */
export const { GET, POST } = handlers
