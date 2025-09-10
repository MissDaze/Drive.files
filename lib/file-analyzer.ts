export interface FileAnalysis {
  id: string
  name: string
  mimeType: string
  size?: string
  content: string
  summary: string
  keywords: string[]
  category: string
  monetizationPotential: number
}

export interface AnalysisResult {
  files: FileAnalysis[]
  overallInsights: string
  bundleSuggestions: BundleSuggestion[]
  monetizationStrategies: string[]
}

export interface BundleSuggestion {
  name: string
  description: string
  fileIds: string[]
  estimatedValue: string
  targetAudience: string
  marketingAngle: string
}

export class FileAnalyzer {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async extractFileContent(fileId: string, mimeType: string): Promise<string> {
    try {
      // Handle different file types
      if (mimeType.includes("application/vnd.google-apps.document")) {
        return await this.exportGoogleDoc(fileId)
      } else if (mimeType.includes("application/vnd.google-apps.spreadsheet")) {
        return await this.exportGoogleSheet(fileId)
      } else if (mimeType.includes("application/vnd.google-apps.presentation")) {
        return await this.exportGoogleSlides(fileId)
      } else if (mimeType.includes("application/pdf")) {
        return await this.extractPdfText(fileId)
      } else if (mimeType.includes("text/")) {
        return await this.getTextFile(fileId)
      }

      return "Content extraction not supported for this file type"
    } catch (error) {
      console.error(`Failed to extract content for file ${fileId}:`, error)
      return "Content extraction failed"
    }
  }

  private async exportGoogleDoc(fileId: string): Promise<string> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    return response.ok ? await response.text() : "Export failed"
  }

  private async exportGoogleSheet(fileId: string): Promise<string> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    return response.ok ? await response.text() : "Export failed"
  }

  private async exportGoogleSlides(fileId: string): Promise<string> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    return response.ok ? await response.text() : "Export failed"
  }

  private async extractPdfText(fileId: string): Promise<string> {
    // For PDF files, we'll get the raw content and indicate it needs processing
    return "PDF content - requires specialized extraction"
  }

  private async getTextFile(fileId: string): Promise<string> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    return response.ok ? await response.text() : "File read failed"
  }

  async getFileMetadata(fileId: string) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,description`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    )
    return response.ok ? await response.json() : null
  }
}

export const ANALYSIS_PROMPTS = {
  COMPREHENSIVE: `You are an expert business consultant and digital product strategist. Analyze the provided files to identify monetization opportunities and strategic insights.`,

  MONETIZATION: `Focus specifically on identifying how these files can be transformed into profitable digital products, courses, or services.`,

  ORGANIZATION: `Analyze these files for optimal organization and categorization to maximize their utility and accessibility.`,

  CONTENT_GAPS: `Identify what additional content or files would be needed to create complete, marketable digital products.`,

  MARKET_ANALYSIS: `Evaluate the market potential and target audience for digital products that could be created from these files.`,
}
