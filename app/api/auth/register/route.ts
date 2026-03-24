import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const BCRYPT_COST = 12

const registerSchema = z.object({
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' })
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .max(128, { message: 'Password must be at most 128 characters.' }),
})

/**
 * POST /api/auth/register
 *
 * Creates a new user account.
 *
 * Request body (JSON):
 *   { email: string; password: string }
 *
 * Responses:
 *   201  { id: string; email: string }
 *   400  { error: string }  — validation failure
 *   409  { error: string }  — email already registered
 *   500  { error: string }  — unexpected server error
 */
export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Invalid request.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { email, password } = parsed.data

    // Check for duplicate email before hashing to give a fast 409
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with that email already exists.' },
        { status: 409 },
      )
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    console.error('[POST /api/auth/register]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
