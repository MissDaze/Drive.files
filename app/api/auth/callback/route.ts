import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { encryptSecret } from "@/lib/crypto"
import { createSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const returnedState = url.searchParams.get("state")
  const expectedState = cookies().get("oauth_state")?.value

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL("/?error=oauth_state", request.url))
  }

  cookies().delete("oauth_state")

  try {
    const origin = process.env.APP_URL || url.origin
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/callback`,
      }),
    })

    const tokens = await tokenResponse.json()
    if (!tokenResponse.ok || !tokens.access_token) {
      throw new Error(tokens.error_description || tokens.error || "Token exchange failed")
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    })
    const profile = await profileResponse.json()

    if (!profileResponse.ok || !profile.id || !profile.email) {
      throw new Error("Could not load Google profile")
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ googleSub: String(profile.id) }, { email: String(profile.email) }] },
    })

    const user = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: {
            googleSub: String(profile.id),
            email: String(profile.email),
            name: profile.name || existing.name,
            avatarUrl: profile.picture || existing.avatarUrl,
          },
        })
      : await db.user.create({
          data: {
            googleSub: String(profile.id),
            email: String(profile.email),
            name: profile.name || null,
            avatarUrl: profile.picture || null,
          },
        })

    const priorConnection = await db.googleConnection.findUnique({ where: { userId: user.id } })

    await db.googleConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        encryptedAccessToken: encryptSecret(tokens.access_token),
        encryptedRefreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
        accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        scope: tokens.scope || null,
      },
      update: {
        encryptedAccessToken: encryptSecret(tokens.access_token),
        encryptedRefreshToken: tokens.refresh_token
          ? encryptSecret(tokens.refresh_token)
          : priorConnection?.encryptedRefreshToken,
        accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        scope: tokens.scope || priorConnection?.scope,
      },
    })

    await createSession(user.id)
    return NextResponse.redirect(new URL("/", request.url))
  } catch (error) {
    console.error("OAuth callback failed", error)
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url))
  }
}
