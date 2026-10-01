import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { fetchDrivePage, getGoogleAccessToken } from "@/lib/google"

export async function POST(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const scan = await db.scan.findFirst({
      where: { id: context.params.id, userId: user.id },
    })

    if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    if (scan.status !== "inventorying") return NextResponse.json({ scan })

    const accessToken = await getGoogleAccessToken(user.id)
    const page = await fetchDrivePage(accessToken, scan.drivePageToken)

    for (let i = 0; i < page.files.length; i += 50) {
      const chunk = page.files.slice(i, i + 50)
      await db.$transaction(
        chunk.map((file) =>
          db.driveFile.upsert({
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
          }),
        ),
      )
    }

    const nextStatus = page.nextPageToken ? "inventorying" : "analysing"
    const updated = await db.scan.update({
      where: { id: scan.id },
      data: {
        drivePageToken: page.nextPageToken || null,
        totalFiles: { increment: page.files.length },
        indexedFiles: { increment: page.files.length },
        status: nextStatus,
      },
    })

    return NextResponse.json({
      scan: updated,
      batchSize: page.files.length,
      hasMore: Boolean(page.nextPageToken),
    })
  } catch (error) {
    console.error("Inventory step failed", error)
    const message = error instanceof Error ? error.message : "Inventory failed"
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 })
  }
}
