"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Folder, ImageIcon, Video, Music, Archive, RefreshCw, Search, Download } from "lucide-react"

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime: string
  webViewLink?: string
  parents?: string[]
}

interface DriveFileListProps {
  files: DriveFile[]
  loading: boolean
  onRefresh: () => void
  selectedFiles: string[]
  onSelectionChange: (selected: string[]) => void
}

export function DriveFileList({ files, loading, onRefresh, selectedFiles, onSelectionChange }: DriveFileListProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("folder")) return <Folder className="h-5 w-5 text-blue-500" />
    if (mimeType.includes("image")) return <ImageIcon className="h-5 w-5 text-green-500" />
    if (mimeType.includes("video")) return <Video className="h-5 w-5 text-purple-500" />
    if (mimeType.includes("audio")) return <Music className="h-5 w-5 text-orange-500" />
    if (mimeType.includes("zip") || mimeType.includes("archive")) return <Archive className="h-5 w-5 text-gray-500" />
    return <FileText className="h-5 w-5 text-blue-600" />
  }

  const getFileType = (mimeType: string) => {
    if (mimeType.includes("document")) return "Document"
    if (mimeType.includes("spreadsheet")) return "Spreadsheet"
    if (mimeType.includes("presentation")) return "Presentation"
    if (mimeType.includes("pdf")) return "PDF"
    if (mimeType.includes("image")) return "Image"
    if (mimeType.includes("video")) return "Video"
    if (mimeType.includes("audio")) return "Audio"
    if (mimeType.includes("folder")) return "Folder"
    return "File"
  }

  const filteredFiles = files.filter((file) => file.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const toggleFileSelection = (fileId: string) => {
    const newSelection = selectedFiles.includes(fileId)
      ? selectedFiles.filter((id) => id !== fileId)
      : [...selectedFiles, fileId]
    onSelectionChange(newSelection)
  }

  const selectAll = () => {
    onSelectionChange(filteredFiles.map((f) => f.id))
  }

  const clearSelection = () => {
    onSelectionChange([])
  }

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Your Drive Files</CardTitle>
            <CardDescription>
              {files.length} files found • {selectedFiles.length} selected
            </CardDescription>
          </div>
          <Button onClick={onRefresh} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={selectAll} variant="outline" size="sm">
              Select All
            </Button>
            <Button onClick={clearSelection} variant="outline" size="sm">
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={selectedFiles.includes(file.id)}
                  onCheckedChange={() => toggleFileSelection(file.id)}
                />

                {getFileIcon(file.mimeType)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{file.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      {getFileType(file.mimeType)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {file.size && `${file.size} • `}
                    Modified {new Date(file.modifiedTime).toLocaleDateString()}
                  </p>
                </div>

                {file.webViewLink && (
                  <Button variant="ghost" size="sm" onClick={() => window.open(file.webViewLink, "_blank")}>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
