import crypto from "crypto"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { hashSessionToken } from "@/lib/crypto"

const SESSION_COOKIE = "asset_session"

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)

  await db.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  })

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  })

  if (!session || session.expiresAt <= new Date()) return null
  return session.user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("UNAUTHENTICATED")
  return user
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
  }
  cookies().delete(SESSION_COOKIE)
}
