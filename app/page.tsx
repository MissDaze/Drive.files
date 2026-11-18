"use client"

// AI Drive Analyzer — Nix Nightshade

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Folder, Sparkles, Package, Brain, HardDrive } from "lucide-react"
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
  const [checkingDrive, setCheckingDrive] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState("")
  const [files, setFiles] = useState<DriveFile[]>([])
  const [analysisQuery, setAnalysisQuery] = useState("")
  const [analysisResult, setAnalysisResult] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])

  const connectToDrive = () => {
    window.location.assign("/api/auth/google")
  }

  const loadFiles = async () => {
    setLoadingFiles(true)
    setError("")

    try {
      const response = await fetch("/api/drive/files", { cache: "no-store" })

      if (response.status === 401) {
        setIsConnected(false)
        setFiles([])
        setSelectedFiles([])
        return
      }

      if (!response.ok) {
        throw new Error(`Could not load Drive files (${response.status})`)
      }

      const data: { files?: DriveFile[] } = await response.json()
      if (!Array.isArray(data.files)) throw new Error("Drive returned an invalid file list")

      const nextFiles = data.files
      setFiles(nextFiles)
      setSelectedFiles((selected) =>
        selected.filter((id) => nextFiles.some((file) => file.id === id))
      )
      setIsConnected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retrieve Drive files")
    } finally {
      setLoadingFiles(false)
      setCheckingDrive(false)
    }
  }

  const analyzeFiles = async () => {
    const query = analysisQuery.trim()
    if (!query || analysing) return

    const fileIds = selectedFiles.length
      ? selectedFiles
      : files.map((file) => file.id)

    if (!fileIds.length) {
      setError("There are no files available to analyse")
      return
    }

    setAnalysing(true)
    setError("")

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, fileIds }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your Drive session has expired. Reconnect and try again.")
        }
        throw new Error(`Analysis failed (${response.status})`)
      }

      const data: { analysis?: string } = await response.json()
      if (typeof data.analysis !== "string") {
        throw new Error("The analysis response was incomplete")
      }

      setAnalysisResult(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to finish the analysis")
    } finally {
      setAnalysing(false)
    }
  }

  useEffect(() => {
    void loadFiles()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
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

        {error && (
          <div role="alert" className="max-w-4xl mx-auto mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {checkingDrive ? (
          <div className="text-center py-16 text-muted-foreground">
            Checking your Drive connection...
          </div>
        ) : !isConnected ? (
          
          <Card className="max-w-md mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full w-fit">
                <HardDrive className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Connect to Google Drive</CardTitle>
              <CardDescription className="text-base">
                Securely connect your Google Drive to start analyzing and organizing your files with AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={connectToDrive}
                disabled={checkingDrive}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-6 text-lg"
              >
                Connect Google Drive
              </Button>
            </CardContent>
          </Card>
        ) : (
          
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
                loading={loadingFiles}
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
                loading={analysing || loadingFiles}
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
