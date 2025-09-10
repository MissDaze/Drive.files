"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Package, Plus, Trash2, Download, Sparkles } from "lucide-react"

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime: string
  webViewLink?: string
  parents?: string[]
}

interface ProductBundle {
  id: string
  name: string
  description: string
  fileIds: string[]
  createdAt: string
}

interface ProductBundlerProps {
  files: DriveFile[]
  selectedFiles: string[]
  onSelectionChange: (selected: string[]) => void
}

export function ProductBundler({ files, selectedFiles, onSelectionChange }: ProductBundlerProps) {
  const [bundles, setBundles] = useState<ProductBundle[]>([])
  const [newBundleName, setNewBundleName] = useState("")
  const [newBundleDescription, setNewBundleDescription] = useState("")
  const [loading, setLoading] = useState(false)

  const createBundle = () => {
    if (!newBundleName.trim() || selectedFiles.length === 0) return

    const newBundle: ProductBundle = {
      id: Date.now().toString(),
      name: newBundleName,
      description: newBundleDescription,
      fileIds: [...selectedFiles],
      createdAt: new Date().toISOString(),
    }

    setBundles([...bundles, newBundle])
    setNewBundleName("")
    setNewBundleDescription("")
    onSelectionChange([])
  }

  const deleteBundle = (bundleId: string) => {
    setBundles(bundles.filter((b) => b.id !== bundleId))
  }

  const generateBundleWithAI = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/generate-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileIds: selectedFiles.length > 0 ? selectedFiles : files.map((f) => f.id),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const aiBundle: ProductBundle = {
          id: Date.now().toString(),
          name: data.name,
          description: data.description,
          fileIds: data.fileIds,
          createdAt: new Date().toISOString(),
        }
        setBundles([...bundles, aiBundle])
      }
    } catch (error) {
      console.error("Failed to generate AI bundle:", error)
    } finally {
      setLoading(false)
    }
  }

  const getSelectedFileNames = () => {
    return files.filter((file) => selectedFiles.includes(file.id)).map((file) => file.name)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bundle Creator */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Create Product Bundle</CardTitle>
              <CardDescription>Bundle selected files into monetizable digital products</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bundle Name</label>
            <Input
              placeholder="e.g., Complete Marketing Guide"
              value={newBundleName}
              onChange={(e) => setNewBundleName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="Brief description of the bundle"
              value={newBundleDescription}
              onChange={(e) => setNewBundleDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Selected Files ({selectedFiles.length})</label>
            <ScrollArea className="h-32 border rounded-md p-2">
              {selectedFiles.length > 0 ? (
                <div className="space-y-1">
                  {getSelectedFileNames().map((name, index) => (
                    <Badge key={index} variant="secondary" className="mr-1 mb-1">
                      {name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No files selected</p>
              )}
            </ScrollArea>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={createBundle}
              disabled={!newBundleName.trim() || selectedFiles.length === 0}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Bundle
            </Button>

            <Button
              onClick={generateBundleWithAI}
              disabled={loading || selectedFiles.length === 0}
              variant="outline"
              className="flex-1 bg-transparent"
            >
              {loading ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Generate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bundle List */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Your Product Bundles</CardTitle>
          <CardDescription>{bundles.length} bundles created</CardDescription>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-96">
            {bundles.length > 0 ? (
              <div className="space-y-4">
                {bundles.map((bundle) => (
                  <div key={bundle.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{bundle.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{bundle.description}</p>
                      </div>
                      <Button
                        onClick={() => deleteBundle(bundle.id)}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <Badge variant="outline">{bundle.fileIds.length} files</Badge>
                      <span className="text-muted-foreground">
                        Created {new Date(bundle.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <Download className="h-4 w-4 mr-2" />
                      Export Bundle
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No bundles yet</p>
                <p className="text-sm">Select files and create your first product bundle</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
