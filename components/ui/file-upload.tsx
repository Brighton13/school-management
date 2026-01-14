"use client"

import React, { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { uploadFile, uploadMultipleFiles, validateFile, FileTypes, type FileValidationOptions } from "@/lib/fileserver"
import { Upload, X, File, Image, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onUploadSuccess?: (files: Array<{ filename: string; url: string }>) => void
  onUploadError?: (error: string) => void
  multiple?: boolean
  accept?: string
  maxFiles?: number
  validationOptions?: FileValidationOptions
  className?: string
  title?: string
  description?: string
}

interface UploadingFile {
  file: File
  progress: number
  error?: string
  success?: boolean
  result?: { filename: string; url: string }
}

export default function FileUpload({
  onUploadSuccess,
  onUploadError,
  multiple = false,
  accept,
  maxFiles = 10,
  validationOptions,
  className,
  title = "Upload Files",
  description = "Drag and drop files here or click to browse",
}: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const { toast } = useToast()

  const handleFileValidation = useCallback((files: File[]): File[] => {
    const validFiles: File[] = []
    
    for (const file of files) {
      const validation = validateFile(file, validationOptions)
      if (!validation.valid) {
        toast({
          title: "File Validation Error",
          description: `${file.name}: ${validation.error}`,
          variant: "destructive",
        })
        continue
      }
      validFiles.push(file)
    }
    
    return validFiles
  }, [validationOptions, toast])

  const uploadFiles = useCallback(async (files: File[]) => {
    const validFiles = handleFileValidation(files)
    if (validFiles.length === 0) return

    // Limit number of files
    const filesToUpload = validFiles.slice(0, maxFiles)
    if (validFiles.length > maxFiles) {
      toast({
        title: "Too Many Files",
        description: `Only the first ${maxFiles} files will be uploaded.`,
        variant: "destructive",
      })
    }

    // Initialize uploading state
    const uploadingFilesState: UploadingFile[] = filesToUpload.map(file => ({
      file,
      progress: 0,
    }))
    setUploadingFiles(uploadingFilesState)

    try {
      if (multiple) {
        // Upload multiple files at once
        const result = await uploadMultipleFiles(filesToUpload)
        
        if (result.success && result.files) {
          // Update state with results
          setUploadingFiles(prev => prev.map((item, index) => ({
            ...item,
            progress: 100,
            success: true,
            result: result.files![index],
          })))
          
          onUploadSuccess?.(result.files)
          toast({
            title: "Upload Successful",
            description: `${result.files.length} files uploaded successfully.`,
          })
        } else {
          throw new Error(result.error || "Upload failed")
        }
      } else {
        // Upload single file
        const file = filesToUpload[0]
        const result = await uploadFile(file)
        
        if (result.success && result.filename && result.url) {
          setUploadingFiles(prev => [{
            ...prev[0],
            progress: 100,
            success: true,
            result: { filename: result.filename!, url: result.url! },
          }])
          
          onUploadSuccess?.([{ filename: result.filename, url: result.url }])
          toast({
            title: "Upload Successful",
            description: "File uploaded successfully.",
          })
        } else {
          throw new Error(result.error || "Upload failed")
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed"
      setUploadingFiles(prev => prev.map(item => ({
        ...item,
        progress: 0,
        error: errorMessage,
      })))
      
      onUploadError?.(errorMessage)
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }, [handleFileValidation, maxFiles, multiple, onUploadSuccess, onUploadError, toast])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    uploadFiles(files)
  }, [uploadFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFiles(Array.from(files))
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ""
  }, [uploadFiles])

  const removeFile = useCallback((index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <Image className="h-4 w-4" />
    } else if (file.type.includes("pdf") || file.type.includes("document") || file.type.includes("text")) {
      return <FileText className="h-4 w-4" />
    }
    return <File className="h-4 w-4" />
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25",
            uploadingFiles.length === 0 ? "cursor-pointer hover:border-primary/50" : ""
          )}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => {
            if (uploadingFiles.length === 0) {
              document.getElementById("file-input")?.click()
            }
          }}
        >
          {uploadingFiles.length === 0 ? (
            <div className="space-y-2">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{description}</p>
              <Button variant="outline" size="sm">
                Choose Files
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {uploadingFiles.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    {getFileIcon(item.file)}
                    <span className="text-sm font-medium truncate">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(item.file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  
                  {item.success ? (
                    <div className="text-green-600 text-sm">✓ Uploaded</div>
                  ) : item.error ? (
                    <div className="text-red-600 text-sm">✗ Failed</div>
                  ) : (
                    <div className="w-24">
                      <Progress value={item.progress} className="h-2" />
                    </div>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                Add More Files
              </Button>
            </div>
          )}
        </div>
        
        <Input
          id="file-input"
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </CardContent>
    </Card>
  )
}