import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ authenticated: false })

  const [connection, latestScan, fileCount, opportunityCount] = await Promise.all([
    db.googleConnection.findUnique({ where: { userId: user.id }, select: { id: true, updatedAt: true } }),
    db.scan.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.driveFile.count({ where: { userId: user.id } }),
    db.opportunity.count({ where: { userId: user.id } }),
  ])

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    driveConnected: Boolean(connection),
    driveAccessMode: process.env.GOOGLE_DRIVE_ACCESS_MODE === "full" ? "full" : "picker",
    latestScan,
    fileCount,
    opportunityCount,
  })
}
