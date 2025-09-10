import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"
import { FileAnalyzer } from "@/lib/file-analyzer"

export async function POST(request: NextRequest) {
  try {
    const { fileIds, bundleType = "general" } = await request.json()

    const cookieStore = cookies()
    const accessToken = cookieStore.get("google_access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const analyzer = new FileAnalyzer(accessToken)

    const fileAnalyses = await Promise.all(
      fileIds.slice(0, 20).map(async (fileId: string) => {
        try {
          const metadata = await analyzer.getFileMetadata(fileId)
          if (!metadata) return null

          const content = await analyzer.extractFileContent(fileId, metadata.mimeType)

          return {
            id: metadata.id,
            name: metadata.name,
            mimeType: metadata.mimeType,
            size: metadata.size,
            content: content.substring(0, 1000),
            description: metadata.description || "",
          }
        } catch (error) {
          return null
        }
      }),
    )

    const validFiles = fileAnalyses.filter(Boolean)

    const { text } = await generateText({
      model: groq("llama-3.1-70b-versatile"),
      prompt: `
You are an expert digital product strategist. Create a highly marketable product bundle from these files.

Files available (${validFiles.length} files):
${validFiles
  .map(
    (file, index) => `
${index + 1}. ${file?.name} (${file?.mimeType})
   Content: ${file?.content?.substring(0, 300) || "No content preview"}
   Description: ${file?.description || "No description"}
`,
  )
  .join("\n")}

Bundle Type: ${bundleType}

Create a strategic product bundle that maximizes commercial value. Consider:

1. **MARKET DEMAND**: What problems do these files solve?
2. **TARGET AUDIENCE**: Who would pay for this bundle?
3. **VALUE PROPOSITION**: Why is this bundle worth buying?
4. **COMPETITIVE ADVANTAGE**: What makes this unique?
5. **PRICING STRATEGY**: What price point makes sense?

Respond with a JSON object:
{
  "name": "Compelling, marketable bundle name",
  "description": "Clear value proposition and benefits (2-3 sentences)",
  "fileIds": ["array", "of", "most", "valuable", "file", "ids"],
  "category": "course|guide|templates|toolkit|masterclass|blueprint",
  "targetAudience": "Specific target market description",
  "valueProposition": "Why customers should buy this",
  "suggestedPrice": "$XX - $XXX range",
  "marketingAngle": "How to position and market this bundle",
  "reasoning": "Strategic explanation for file selection and bundling"
}

Focus on creating bundles that solve real problems and provide clear value to customers.
      `,
    })

    try {
      const bundleData = JSON.parse(text)
      return NextResponse.json(bundleData)
    } catch (parseError) {
      const selectedFiles = validFiles.slice(0, Math.min(8, validFiles.length))
      return NextResponse.json({
        name: "Strategic Content Bundle",
        description: "Curated collection of valuable content designed to solve specific business challenges",
        fileIds: selectedFiles.map((f) => f?.id).filter(Boolean),
        category: "toolkit",
        targetAudience: "Business professionals and entrepreneurs",
        valueProposition: "Comprehensive resources to accelerate business growth",
        suggestedPrice: "$47 - $197 range",
        marketingAngle: "Position as a complete solution toolkit",
        reasoning: "Selected files with highest content value and market appeal",
      })
    }
  } catch (error) {
    console.error("Bundle generation error:", error)
    return NextResponse.json({ error: "Bundle generation failed" }, { status: 500 })
  }
}
