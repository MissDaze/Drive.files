import type { DriveFile } from "@prisma/client"

export type ExtractedAsset = {
  status: "ready" | "unsupported" | "failed"
  text?: string
  imageDataUrl?: string
  note?: string
}

async function download(accessToken: string, fileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Drive download failed (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

async function exportGoogle(accessToken: string, fileId: string, mimeType: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}/export`)
  url.searchParams.set("mimeType", mimeType)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Drive export failed (${response.status})`)
  return response.text()
}

export async function extractDriveAsset(accessToken: string, file: DriveFile): Promise<ExtractedAsset> {
  try {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      return { status: "unsupported", note: "Folder metadata only" }
    }

    if (file.mimeType === "application/vnd.google-apps.document") {
      return { status: "ready", text: (await exportGoogle(accessToken, file.driveFileId, "text/plain")).slice(0, 30000) }
    }

    if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
      return { status: "ready", text: (await exportGoogle(accessToken, file.driveFileId, "text/csv")).slice(0, 30000) }
    }

    if (file.mimeType === "application/vnd.google-apps.presentation") {
      return { status: "ready", text: (await exportGoogle(accessToken, file.driveFileId, "text/plain")).slice(0, 30000) }
    }

    if (file.mimeType === "application/pdf") {
      if (Number(file.size || 0) > 15_000_000) return { status: "unsupported", note: "PDF exceeds 15 MB analysis limit" }
      const buffer = await download(accessToken, file.driveFileId)
      const mod = await import("pdf-parse")
      const parser = (mod as any).default || mod
      const result = await parser(buffer)
      return { status: "ready", text: String(result.text || "").slice(0, 30000) }
    }

    if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      if (Number(file.size || 0) > 15_000_000) return { status: "unsupported", note: "DOCX exceeds 15 MB analysis limit" }
      const mammoth = await import("mammoth")
      const result = await mammoth.extractRawText({ buffer: await download(accessToken, file.driveFileId) })
      return { status: "ready", text: result.value.slice(0, 30000) }
    }

    if (
      file.mimeType.startsWith("text/") ||
      ["application/json", "application/xml", "application/javascript"].includes(file.mimeType)
    ) {
      const body = await download(accessToken, file.driveFileId)
      return { status: "ready", text: body.toString("utf8").slice(0, 30000) }
    }

    if (file.mimeType.startsWith("image/")) {
      if (Number(file.size || 0) > 6_000_000) return { status: "unsupported", note: "Image exceeds 6 MB analysis limit" }
      const body = await download(accessToken, file.driveFileId)
      return {
        status: "ready",
        imageDataUrl: `data:${file.mimeType};base64,${body.toString("base64")}`,
      }
    }

    return { status: "unsupported", note: `Unsupported MIME type: ${file.mimeType}` }
  } catch (error) {
    return {
      status: "failed",
      note: error instanceof Error ? error.message : "Content extraction failed",
    }
  }
}
