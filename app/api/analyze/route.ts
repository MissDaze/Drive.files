import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"
import { FileAnalyzer, ANALYSIS_PROMPTS } from "@/lib/file-analyzer"

export async function POST(request: NextRequest) {
  try {
    const { query, fileIds, analysisType = "comprehensive" } = await request.json()

    const cookieStore = cookies()
    const accessToken = cookieStore.get("google_access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const analyzer = new FileAnalyzer(accessToken)

    // Process files with enhanced analysis
    const fileAnalyses = await Promise.all(
      fileIds.slice(0, 15).map(async (fileId: string) => {
        try {
          const metadata = await analyzer.getFileMetadata(fileId)
          if (!metadata) return null

          const content = await analyzer.extractFileContent(fileId, metadata.mimeType)

          return {
            id: metadata.id,
            name: metadata.name,
            mimeType: metadata.mimeType,
            size: metadata.size,
            content: content.substring(0, 3000), // Increased content limit
            description: metadata.description || "",
          }
        } catch (error) {
          console.error(`Error processing file ${fileId}:`, error)
          return null
        }
      }),
    )

    const validFiles = fileAnalyses.filter(Boolean)

    const basePrompt =
      ANALYSIS_PROMPTS[analysisType.toUpperCase() as keyof typeof ANALYSIS_PROMPTS] || ANALYSIS_PROMPTS.COMPREHENSIVE

    const { text } = await generateText({
      model: groq("llama-3.1-70b-versatile"),
      prompt: `
${basePrompt}

User Query: "${query}"

Files to analyze (${validFiles.length} files):
${validFiles
  .map(
    (file, index) => `
=== FILE ${index + 1} ===
Name: ${file?.name}
Type: ${file?.mimeType}
Size: ${file?.size || "Unknown"}
Description: ${file?.description || "No description"}
Content Preview: ${file?.content?.substring(0, 800) || "No content available"}
---`,
  )
  .join("\n")}

Please provide a comprehensive analysis that includes:

1. **CONTENT ANALYSIS**: Summarize what each file contains and its potential value
2. **MONETIZATION OPPORTUNITIES**: Specific ways these files can generate revenue
3. **PRODUCT BUNDLE SUGGESTIONS**: Concrete digital products that can be created
4. **TARGET MARKET**: Who would buy these products and why
5. **PRICING STRATEGY**: Suggested pricing tiers and value propositions
6. **CONTENT GAPS**: What additional content is needed to maximize value
7. **MARKETING ANGLES**: How to position and market these products
8. **IMPLEMENTATION ROADMAP**: Step-by-step plan to monetize these assets

Be specific, actionable, and focus on practical business strategies. Consider different monetization models like:
- Online courses and training programs
- Digital templates and tools
- Consulting packages and services
- Subscription content
- One-time digital products
- Licensing opportunities

Format your response clearly with headers and bullet points for easy reading.
      `,
    })

    return NextResponse.json({
      analysis: text,
      fileCount: validFiles.length,
      analysisType,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json(
      {
        error: "Analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
