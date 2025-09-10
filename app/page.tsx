"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Folder, Sparkles, Package, Brain, Drill as Drive } from "lucide-react"
import { DriveFileList } from "@/components/drive-file-list"
import { AIAnalysisPanel } from "@/components/ai-analysis-panel"
import { ProductBundler } from "@/components/product-bundler"

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime: string
  webViewLink?: string
  parents?: string[]
}

export default function HomePage() {
  const [isConnected, setIsConnected] = useState(false)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [analysisQuery, setAnalysisQuery] = useState("")
  const [analysisResult, setAnalysisResult] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])

  const connectToDrive = async () => {
    setLoading(true)
    try {
      // Redirect to Google OAuth
      window.location.href = "/api/auth/google"
    } catch (error) {
      console.error("Failed to connect to Google Drive:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/drive/files")
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
        setIsConnected(true)
      }
    } catch (error) {
      console.error("Failed to load files:", error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeFiles = async () => {
    if (!analysisQuery.trim()) return

    setLoading(true)
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: analysisQuery,
          fileIds: selectedFiles.length > 0 ? selectedFiles : files.map((f) => f.id),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setAnalysisResult(data.analysis)
      }
    } catch (error) {
      console.error("Analysis failed:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check if user is already authenticated
    loadFiles()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              AI Drive Analyzer
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
            Intelligently analyze, organize, and create monetizable digital products from your Google Drive files using
            advanced AI
          </p>
        </div>

        {!isConnected ? (
          /* Connection Card */
          <Card className="max-w-md mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full w-fit">
                <Drive className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Connect to Google Drive</CardTitle>
              <CardDescription className="text-base">
                Securely connect your Google Drive to start analyzing and organizing your files with AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={connectToDrive}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-6 text-lg"
              >
                {loading ? "Connecting..." : "Connect Google Drive"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Main Dashboard */
          <Tabs defaultValue="files" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <TabsTrigger value="files" className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Files & Folders
              </TabsTrigger>
              <TabsTrigger value="analyze" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="bundle" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Product Bundler
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="space-y-6">
              <DriveFileList
                files={files}
                loading={loading}
                onRefresh={loadFiles}
                selectedFiles={selectedFiles}
                onSelectionChange={setSelectedFiles}
              />
            </TabsContent>

            <TabsContent value="analyze" className="space-y-6">
              <AIAnalysisPanel
                query={analysisQuery}
                onQueryChange={setAnalysisQuery}
                result={analysisResult}
                loading={loading}
                onAnalyze={analyzeFiles}
                selectedCount={selectedFiles.length}
                totalCount={files.length}
              />
            </TabsContent>

            <TabsContent value="bundle" className="space-y-6">
              <ProductBundler files={files} selectedFiles={selectedFiles} onSelectionChange={setSelectedFiles} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
