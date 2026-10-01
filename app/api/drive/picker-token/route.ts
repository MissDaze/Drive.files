import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getGoogleAccessToken } from "@/lib/google"

export async function GET() {
  try {
    const user = await requireUser()
    if (process.env.GOOGLE_DRIVE_ACCESS_MODE === "full") {
      return NextResponse.json({ error: "Picker token is only used in picker mode" }, { status: 400 })
    }

    const accessToken = await getGoogleAccessToken(user.id)
    return NextResponse.json({ accessToken })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Picker token"
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 })
  }
}
