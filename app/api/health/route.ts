import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    await db.$queryRawUnsafe("SELECT 1")
    return NextResponse.json({ ok: true, database: "ok" })
  } catch {
    return NextResponse.json({ ok: false, database: "error" }, { status: 503 })
  }
}
