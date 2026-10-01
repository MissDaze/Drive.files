import { db } from "@/lib/db"
import { decryptSecret, encryptSecret } from "@/lib/crypto"

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const connection = await db.googleConnection.findUnique({ where: { userId } })
  if (!connection) throw new Error("GOOGLE_NOT_CONNECTED")

  if (connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(connection.encryptedAccessToken)
  }

  if (!connection.encryptedRefreshToken) throw new Error("GOOGLE_RECONNECT_REQUIRED")

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: decryptSecret(connection.encryptedRefreshToken),
      grant_type: "refresh_token",
    }),
  })

  const tokens = await response.json()
  if (!response.ok || !tokens.access_token) {
    throw new Error("GOOGLE_RECONNECT_REQUIRED")
  }

  await db.googleConnection.update({
    where: { userId },
    data: {
      encryptedAccessToken: encryptSecret(tokens.access_token),
      accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
      scope: tokens.scope || connection.scope,
    },
  })

  return tokens.access_token
}

export async function fetchDrivePage(accessToken: string, pageToken?: string | null) {
  const params = new URLSearchParams({
    pageSize: "500",
    spaces: "drive",
    q: "trashed = false",
    fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",
  })
  if (pageToken) params.set("pageToken", pageToken)

  const response = await fetch("https://www.googleapis.com/drive/v3/files?" + params.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Drive API failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  return response.json() as Promise<{
    nextPageToken?: string
    files: Array<{
      id: string
      name: string
      mimeType: string
      size?: string
      modifiedTime?: string
      webViewLink?: string
      parents?: string[]
    }>
  }>
}
