import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const user = await requireUser()
    const latestCompletedScan = await db.scan.findFirst({
      where: { userId: user.id, status: "completed" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    const opportunities = latestCompletedScan
      ? await db.opportunity.findMany({
          where: { userId: user.id, scanId: latestCompletedScan.id },
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: 100,
        })
      : []

    return NextResponse.json({ opportunities, scanId: latestCompletedScan?.id || null })
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    return NextResponse.json({ error: "Could not load opportunities" }, { status: 500 })
  }
}
