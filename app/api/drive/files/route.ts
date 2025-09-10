import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const accessToken = cookieStore.get("google_access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Fetch files from Google Drive API
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?" +
        "pageSize=100&" +
        "fields=files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error("Failed to fetch files from Google Drive")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Drive API error:", error)
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 })
  }
}
