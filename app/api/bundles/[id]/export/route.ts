import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getGoogleAccessToken } from "@/lib/google"

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 140) || "file"
}

async function downloadNormal(accessToken: string, driveFileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function exportGoogle(accessToken: string, driveFileId: string, mimeType: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${driveFileId}/export`)
  url.searchParams.set("mimeType", mimeType)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Export failed: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const bundle = await db.bundle.findFirst({ where: { id: context.params.id, userId: user.id } })
    if (!bundle) return NextResponse.json({ error: "Bundle not found" }, { status: 404 })

    const ids = Array.isArray(bundle.fileIds) ? bundle.fileIds.map(String) : []
    const files = await db.driveFile.findMany({
      where: { userId: user.id, id: { in: ids } },
    })

    const accessToken = await getGoogleAccessToken(user.id)
    const zip = new JSZip()
    zip.file("manifest.json", JSON.stringify(bundle.manifest || {}, null, 2))

    for (const file of files) {
      try {
        let data: Buffer
        let filename = safeName(file.name)

        if (file.mimeType === "application/vnd.google-apps.document") {
          data = await exportGoogle(accessToken, file.driveFileId, "application/pdf")
          filename += ".pdf"
        } else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
          data = await exportGoogle(
            accessToken,
            file.driveFileId,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          )
          filename += ".xlsx"
        } else if (file.mimeType === "application/vnd.google-apps.presentation") {
          data = await exportGoogle(accessToken, file.driveFileId, "application/pdf")
          filename += ".pdf"
        } else if (file.mimeType === "application/vnd.google-apps.folder") {
          continue
        } else {
          data = await downloadNormal(accessToken, file.driveFileId)
        }

        zip.file(filename, data)
      } catch (error) {
        zip.file(
          `errors/${safeName(file.name)}.txt`,
          `Could not export this source file: ${error instanceof Error ? error.message : "unknown error"}`,
        )
      }
    }

    const output = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
    const filename = safeName(bundle.name).replace(/\s+/g, "-").toLowerCase() + ".zip"

    return new NextResponse(output, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : "Bundle export failed"
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 })
  }
}
