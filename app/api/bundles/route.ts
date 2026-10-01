import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const user = await requireUser()
    const bundles = await db.bundle.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return NextResponse.json({ bundles })
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    return NextResponse.json({ error: "Could not load bundles" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const fileIds = Array.from(new Set(Array.isArray(body.fileIds) ? body.fileIds.map(String) : []))

    if (!body.name || fileIds.length === 0) {
      return NextResponse.json({ error: "name and fileIds are required" }, { status: 400 })
    }

    const ownedFiles = await db.driveFile.findMany({
      where: { userId: user.id, id: { in: fileIds } },
      select: { id: true, name: true, mimeType: true, webViewLink: true },
    })

    if (ownedFiles.length !== fileIds.length) {
      return NextResponse.json({ error: "One or more files are not available to this user" }, { status: 400 })
    }

    const bundle = await db.bundle.create({
      data: {
        userId: user.id,
        name: String(body.name).slice(0, 160),
        description: body.description ? String(body.description).slice(0, 2000) : null,
        fileIds,
        manifest: {
          source: "Google Drive",
          fileCount: ownedFiles.length,
          files: ownedFiles,
          createdAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({ bundle })
  } catch (error) {
    console.error(error)
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    return NextResponse.json({ error: "Could not save bundle" }, { status: 500 })
  }
}
