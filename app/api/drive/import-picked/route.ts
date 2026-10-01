import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getGoogleAccessToken } from "@/lib/google"

type DriveMeta = {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
  parents?: string[]
}

async function getMeta(accessToken: string, fileId: string): Promise<DriveMeta> {
  const fields = "id,name,mimeType,size,modifiedTime,webViewLink,parents"
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Could not import Drive file ${fileId}: ${response.status} ${detail.slice(0, 180)}`)
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (process.env.GOOGLE_DRIVE_ACCESS_MODE === "full") {
      return NextResponse.json({ error: "File picking is not required in full-drive mode" }, { status: 400 })
    }

    const body = await request.json()
    const fileIds = Array.from(new Set(Array.isArray(body.fileIds) ? body.fileIds.map(String) : [])).slice(0, 200)

    if (!fileIds.length) {
      return NextResponse.json({ error: "No Drive files were selected" }, { status: 400 })
    }

    const accessToken = await getGoogleAccessToken(user.id)
    const imported: string[] = []
    const failed: Array<{ id: string; error: string }> = []

    for (const fileId of fileIds) {
      try {
        const file = await getMeta(accessToken, fileId)
        await db.driveFile.upsert({
          where: { userId_driveFileId: { userId: user.id, driveFileId: file.id } },
          create: {
            userId: user.id,
            driveFileId: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size || null,
            modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
            webViewLink: file.webViewLink || null,
            parentIds: file.parents || [],
            lastIndexedAt: new Date(),
          },
          update: {
            name: file.name,
            mimeType: file.mimeType,
            size: file.size || null,
            modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
            webViewLink: file.webViewLink || null,
            parentIds: file.parents || [],
            lastIndexedAt: new Date(),
          },
        })
        imported.push(file.id)
      } catch (error) {
        failed.push({
          id: fileId,
          error: error instanceof Error ? error.message : "Import failed",
        })
      }
    }

    return NextResponse.json({ importedCount: imported.length, failed })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import selected files"
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 })
  }
}
