import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getGoogleAccessToken } from "@/lib/google"
import { extractDriveAsset } from "@/lib/drive-content"
import { callOpenRouter, parseModelJson, type OpenRouterPart } from "@/lib/openrouter"

type AssetResult = {
  summary: string
  category: string
  monetizationPotential: number
  keywords: string[]
  commercialUse?: string
  suggestedRole?: string
}

function promptFor(name: string, mimeType: string, text?: string) {
  return `You are cataloguing a user's private cloud-drive assets to identify useful intellectual property and legitimate commercial opportunities.

Analyse ONE asset. Do not invent facts not present in the asset. Distinguish an actual product/project from raw research or supporting material.

File name: ${name}
MIME type: ${mimeType}
${text ? `Content:\n${text}` : "The image is attached below."}

Return ONLY a JSON object with:
{
  "summary": "1-3 factual sentences",
  "category": "project|research|dataset|template|process|content|technical_spec|sales_material|brand_asset|reference|duplicate|junk",
  "monetizationPotential": 0-100,
  "keywords": ["up to 8 concise terms"],
  "commercialUse": "what legitimate commercial role this asset could play, or null",
  "suggestedRole": "standalone_product|supporting_asset|bundle_component|internal_only|no_value"
}

Score conservatively. A draft, duplicate, personal admin file, generic note, or unsupported fragment should not receive a high score.`
}

export async function POST(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const scan = await db.scan.findFirst({ where: { id: context.params.id, userId: user.id } })
    if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    if (scan.status !== "analysing") return NextResponse.json({ scan })

    const files = await db.driveFile.findMany({
      where: {
        userId: user.id,
        analyses: { none: { scanId: scan.id } },
      },
      orderBy: [{ modifiedTime: "desc" }, { id: "asc" }],
      take: 4,
    })

    if (files.length === 0) {
      const updated = await db.scan.update({
        where: { id: scan.id },
        data: { status: "synthesizing" },
      })
      return NextResponse.json({ scan: updated, processed: 0 })
    }

    const accessToken = await getGoogleAccessToken(user.id)
    let analysed = 0
    let skipped = 0

    for (const file of files) {
      const extracted = await extractDriveAsset(accessToken, file)

      if (extracted.status !== "ready") {
        await db.$transaction([
          db.assetAnalysis.create({
            data: {
              scanId: scan.id,
              driveFileId: file.id,
              summary: extracted.note || "No readable content extracted.",
              category: "junk",
              monetizationPotential: 0,
              keywords: [],
              commercialUse: null,
              suggestedRole: "no_value",
            },
          }),
          db.driveFile.update({
            where: { id: file.id },
            data: { contentStatus: extracted.status, contentPreview: extracted.note || null },
          }),
        ])
        skipped++
        continue
      }

      const basePrompt = promptFor(file.name, file.mimeType, extracted.text)
      const content: string | OpenRouterPart[] = extracted.imageDataUrl
        ? [
            { type: "text", text: basePrompt },
            { type: "image_url", image_url: { url: extracted.imageDataUrl } },
          ]
        : basePrompt

      try {
        const raw = await callOpenRouter(content)
        const result = parseModelJson<AssetResult>(raw)
        const score = Math.max(0, Math.min(100, Number(result.monetizationPotential || 0)))

        await db.$transaction([
          db.assetAnalysis.create({
            data: {
              scanId: scan.id,
              driveFileId: file.id,
              summary: String(result.summary || "Analysed asset"),
              category: String(result.category || "reference"),
              monetizationPotential: score,
              keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 8) : [],
              commercialUse: result.commercialUse ? String(result.commercialUse) : null,
              suggestedRole: result.suggestedRole ? String(result.suggestedRole) : null,
            },
          }),
          db.driveFile.update({
            where: { id: file.id },
            data: {
              contentStatus: "analysed",
              contentPreview: extracted.text?.slice(0, 5000) || "[image analysed]",
            },
          }),
        ])
        analysed++
      } catch (error) {
        const note = error instanceof Error ? error.message : "AI analysis failed"
        await db.$transaction([
          db.assetAnalysis.create({
            data: {
              scanId: scan.id,
              driveFileId: file.id,
              summary: `Analysis failed: ${note}`,
              category: "reference",
              monetizationPotential: 0,
              keywords: [],
              commercialUse: null,
              suggestedRole: "internal_only",
            },
          }),
          db.driveFile.update({
            where: { id: file.id },
            data: { contentStatus: "failed" },
          }),
        ])
        skipped++
      }
    }

    const remaining = await db.driveFile.count({
      where: { userId: user.id, analyses: { none: { scanId: scan.id } } },
    })

    const updated = await db.scan.update({
      where: { id: scan.id },
      data: {
        analysedFiles: { increment: analysed },
        skippedFiles: { increment: skipped },
        status: remaining === 0 ? "synthesizing" : "analysing",
      },
    })

    return NextResponse.json({ scan: updated, processed: files.length, remaining })
  } catch (error) {
    console.error("Analysis step failed", error)
    const message = error instanceof Error ? error.message : "Analysis failed"
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 })
  }
}
