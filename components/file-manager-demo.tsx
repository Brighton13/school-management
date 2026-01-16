"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import FileUpload from "@/components/ui/file-upload"
import { FileTypes } from "@/lib/fileserver"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Download } from "lucide-react"

interface UploadedFile {
  filename: string
  url: string
}

export default function FileManagerDemo() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  const handleUploadSuccess = (files: UploadedFile[]) => {
    setUploadedFiles(prev => [...prev, ...files])
  }

  const handleDownload = async (filename: string) => {
    try {
      const { downloadFile } = await import("@/lib/fileserver")
      await downloadFile(filename)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single File Upload */}
        <FileUpload
          title="Upload Single File"
          description="Upload a single document or image"
          multiple={false}
          onUploadSuccess={handleUploadSuccess}
          validationOptions={{
            maxSize: 5 * 1024 * 1024, // 5MB
            allowedTypes: [...FileTypes.DOCUMENTS, ...FileTypes.IMAGES],
          }}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
        />

        {/* Multiple File Upload */}
        <FileUpload
          title="Upload Multiple Files"
          description="Upload multiple documents at once"
          multiple={true}
          maxFiles={5}
          onUploadSuccess={handleUploadSuccess}
          validationOptions={{
            maxSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: FileTypes.ALL_OFFICE,
          }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx"
        />
      </div>

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex flex-col p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.filename}>
                        {file.filename}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {file.filename.split('.').pop()?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.filename)}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, "_blank")}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Information */}
      <Card>
        <CardHeader>
          <CardTitle>File Server Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground mb-2">Features:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Secure file upload with authentication</li>
              <li>Support for single and multiple file uploads</li>
              <li>File type and size validation</li>
              <li>Drag and drop interface</li>
              <li>Progress tracking</li>
              <li>Direct download capability</li>
            </ul>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground mb-2">Supported File Types:</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">PDF</Badge>
              <Badge variant="outline">Word Documents</Badge>
              <Badge variant="outline">Excel Spreadsheets</Badge>
              <Badge variant="outline">Images (JPEG, PNG, GIF)</Badge>
              <Badge variant="outline">CSV Files</Badge>
              <Badge variant="outline">PowerPoint</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}