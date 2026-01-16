const FILESERVER_URL = process.env.FILESERVER_URL || "http://localhost:3012"

export interface FileUploadResult {
  success: boolean
  filename?: string
  url?: string
  error?: string
}

export interface MultipleFileUploadResult {
  success: boolean
  files?: Array<{
    filename: string
    url: string
  }>
  error?: string
}

/**
 * Upload a single file to the fileserver
 */
export async function uploadFile(file: File): Promise<FileUploadResult> {
  try {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Upload failed")
    }

    return result
  } catch (error) {
    console.error("File upload error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Upload multiple files to the fileserver
 */
export async function uploadMultipleFiles(files: FileList | File[]): Promise<MultipleFileUploadResult> {
  try {
    const formData = new FormData()
    
    // Convert FileList to array if needed and append each file
    const fileArray = Array.from(files)
    fileArray.forEach((file) => {
      formData.append("files", file)
    })

    const response = await fetch("/api/files/upload-multiple", {
      method: "POST",
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Upload failed")
    }

    return result
  } catch (error) {
    console.error("Multiple files upload error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Download a file from the fileserver
 */
export async function downloadFile(filename: string): Promise<void> {
  try {
    const response = await fetch(`/api/files/download/${encodeURIComponent(filename)}`)

    if (!response.ok) {
      throw new Error("Download failed")
    }

    // Create a blob from the response
    const blob = await response.blob()
    
    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error("File download error:", error)
    throw error
  }
}

/**
 * Get the public URL for a file (for display purposes)
 */
export function getFileUrl(filename: string): string {
  return `${FILESERVER_URL}/uploads/${filename}`
}

/**
 * Validate file type and size
 */
export interface FileValidationOptions {
  maxSize?: number // in bytes
  allowedTypes?: string[] // MIME types
}

export function validateFile(file: File, options: FileValidationOptions = {}): { valid: boolean; error?: string } {
  const { maxSize = 10 * 1024 * 1024, allowedTypes } = options // Default 10MB

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    }
  }

  // Check file type if specified
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    }
  }

  return { valid: true }
}

/**
 * Common file type groups
 */
export const FileTypes = {
  IMAGES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  DOCUMENTS: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  SPREADSHEETS: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"],
  ALL_OFFICE: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
}