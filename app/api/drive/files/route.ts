import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get("page") || 1))
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 50)))
    const search = (url.searchParams.get("search") || "").trim()

    const where = {
      userId: user.id,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    }

    const [files, total] = await Promise.all([
      db.driveFile.findMany({
        where,
        orderBy: { modifiedTime: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.driveFile.count({ where }),
    ])

    return NextResponse.json({ files, total, page, pageSize })
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: "Could not load indexed files" }, { status: 500 })
  }
}
