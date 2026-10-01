import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { callOpenRouter, parseModelJson } from "@/lib/openrouter"

type Candidate = {
  title: string
  description: string
  score: number
  fileIds: string[]
  targetAudience: string
  suggestedPrice?: string
  monetization: string
  missingPieces?: string[]
  nextSteps?: string[]
}

export async function POST(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await requireUser()
    const scan = await db.scan.findFirst({ where: { id: context.params.id, userId: user.id } })
    if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    if (scan.status !== "synthesizing") return NextResponse.json({ scan })

    const batch = await db.assetAnalysis.findMany({
      where: {
        scanId: scan.id,
        monetizationPotential: { gt: 10 },
      },
      include: { driveFile: true },
      orderBy: { id: "asc" },
      skip: scan.synthesisOffset,
      take: 75,
    })

    if (batch.length === 0) {
      const completed = await db.scan.update({
        where: { id: scan.id },
        data: { status: "completed", completedAt: new Date() },
      })
      return NextResponse.json({ scan: completed, opportunitiesCreated: 0 })
    }

    const compactAssets = batch.map((item) => ({
      assetId: item.driveFile.id,
      fileName: item.driveFile.name,
      category: item.category,
      score: item.monetizationPotential,
      summary: item.summary,
      commercialUse: item.commercialUse,
      suggestedRole: item.suggestedRole,
      keywords: item.keywords,
    }))

    const raw = await callOpenRouter(`You are an asset-portfolio analyst. Find coherent, legitimate commercial opportunities from the assets below.

Important rules:
- Do not bundle unrelated files merely because they share broad keywords.
- Identify existing projects separately from hypothetical new combinations.
- Prefer opportunities that already have substantial supporting material.
- Explain the buyer, not just the end user.
- Choose the best monetisation route: outright asset sale, SaaS, subscription, licensing, template/download, course/training, service enablement, lead magnet, or keep/internal.
- Prices are rough AUD commercial-positioning ranges, not guaranteed valuations.
- Return at most 6 opportunities from this batch.

Assets:
${JSON.stringify(compactAssets)}

Return ONLY:
{
  "opportunities": [
    {
      "title": "...",
      "description": "what already exists and why the files belong together",
      "score": 0-100,
      "fileIds": ["assetId values only"],
      "targetAudience": "specific buyer/customer",
      "suggestedPrice": "AUD range or null",
      "monetization": "best route and reasoning in 1-2 sentences",
      "missingPieces": ["specific gaps"],
      "nextSteps": ["ordered practical actions"]
    }
  ]
}`)

    const parsed = parseModelJson<{ opportunities?: Candidate[] }>(raw)
    const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities.slice(0, 6) : []

    for (const opportunity of opportunities) {
      await db.opportunity.create({
        data: {
          userId: user.id,
          scanId: scan.id,
          title: String(opportunity.title || "Untitled opportunity"),
          description: String(opportunity.description || ""),
          score: Math.max(0, Math.min(100, Number(opportunity.score || 0))),
          fileIds: Array.isArray(opportunity.fileIds) ? opportunity.fileIds : [],
          targetAudience: String(opportunity.targetAudience || "Not determined"),
          suggestedPrice: opportunity.suggestedPrice ? String(opportunity.suggestedPrice) : null,
          monetization: String(opportunity.monetization || "Further assessment required"),
          missingPieces: Array.isArray(opportunity.missingPieces) ? opportunity.missingPieces : [],
          nextSteps: Array.isArray(opportunity.nextSteps) ? opportunity.nextSteps : [],
        },
      })
    }

    const nextOffset = scan.synthesisOffset + batch.length
    const more = batch.length === 75
    const updated = await db.scan.update({
      where: { id: scan.id },
      data: {
        synthesisOffset: nextOffset,
        status: more ? "synthesizing" : "completed",
        completedAt: more ? null : new Date(),
      },
    })

    return NextResponse.json({
      scan: updated,
      opportunitiesCreated: opportunities.length,
      more,
    })
  } catch (error) {
    console.error("Synthesis step failed", error)
    const message = error instanceof Error ? error.message : "Synthesis failed"
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 })
  }
}
