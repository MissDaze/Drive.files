"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Brain, FileText, Lightbulb } from "lucide-react"
import { useState } from "react"

interface AIAnalysisPanelProps {
  query: string
  onQueryChange: (query: string) => void
  result: string
  loading: boolean
  onAnalyze: () => void
  selectedCount: number
  totalCount: number
}

export function AIAnalysisPanel({
  query,
  onQueryChange,
  result,
  loading,
  onAnalyze,
  selectedCount,
  totalCount,
}: AIAnalysisPanelProps) {
  const [analysisType, setAnalysisType] = useState("comprehensive")

  const exampleQueries = [
    "Find all files related to sales and marketing that could be bundled into a digital product",
    "Analyze my documents and suggest monetizable digital assets I can create",
    "Identify files that could be combined into an online course or training material",
    "Find documents suitable for creating a comprehensive business guide",
    "Suggest ways to package my content into sellable digital products",
    "What digital products could I create to generate passive income from these files?",
    "How can I turn my expertise documented in these files into a profitable business?",
  ]

  const analysisTypes = [
    { value: "comprehensive", label: "Comprehensive Analysis", description: "Full business and monetization analysis" },
    { value: "monetization", label: "Monetization Focus", description: "Focus on revenue opportunities" },
    {
      value: "organization",
      label: "Organization Strategy",
      description: "Optimal file organization and categorization",
    },
    { value: "market_analysis", label: "Market Analysis", description: "Target audience and market potential" },
  ]

  const analyzeWithType = async () => {
    if (!query.trim()) return

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          fileIds: selectedCount > 0 ? [] : [], // This will be handled by parent component
          analysisType,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Handle response in parent component
      }
    } catch (error) {
      console.error("Analysis failed:", error)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Query Input */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>AI Analysis Query</CardTitle>
              <CardDescription>Analyzing {selectedCount > 0 ? selectedCount : totalCount} files</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Analysis Type</label>
            <select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
            >
              {analysisTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          <Textarea
            placeholder="Describe what you want to analyze or create from your files..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            rows={4}
            className="resize-none"
          />

          <Button
            onClick={onAnalyze}
            disabled={loading || !query.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {loading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze Files
              </>
            )}
          </Button>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Example queries:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {exampleQueries.map((example, index) => (
                <button
                  key={index}
                  onClick={() => onQueryChange(example)}
                  className="text-left text-sm text-blue-600 hover:text-blue-800 hover:underline block w-full text-balance"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
              <Lightbulb className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Analysis Results</CardTitle>
              <CardDescription>AI-powered insights and recommendations</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-80">
            {result ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed space-y-4">
                  {result.split("\n\n").map((section, index) => (
                    <div key={index} className="border-l-2 border-blue-200 pl-4">
                      {section}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No analysis yet</p>
                <p className="text-sm text-balance">
                  Enter a query above and click "Analyze Files" to get AI-powered insights about your documents
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
