import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const user = await requireUser()
    const scans = await db.scan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    return NextResponse.json({ scans })
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    return NextResponse.json({ error: "Could not load scans" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const user = await requireUser()
    const connection = await db.googleConnection.findUnique({ where: { userId: user.id } })
    if (!connection) return NextResponse.json({ error: "Connect Google Drive first" }, { status: 400 })

    const scan = await db.scan.create({
      data: { userId: user.id, status: "inventorying" },
    })

    return NextResponse.json({ scan })
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: "Could not start scan" }, { status: 500 })
  }
}
