"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, CheckCircle, Eye } from "lucide-react"
import { useSession } from "next-auth/react"

interface CurrentSignature {
  id: string
  signatureType: string
  signatureImage: string
  createdAt: string
  updatedAt: string
}

export default function SignaturesPage() {
  const { data: session } = useSession()
  const [signatureType, setSignatureType] = useState<string>("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currentSignature, setCurrentSignature] = useState<CurrentSignature | null>(null)
  const [loadingCurrent, setLoadingCurrent] = useState(true)

  useEffect(() => {
    // Set default signature type based on role
    if (session?.user.role === "PRINCIPAL") {
      setSignatureType("PRINCIPAL")
    } else if (session?.user.role === "TEACHER") {
      setSignatureType("CLASS_TEACHER")
    }
    
    // Fetch current signature
    fetchCurrentSignature()
  }, [session])

  const fetchCurrentSignature = async () => {
    if (!session?.user?.id) return
    
    try {
      setLoadingCurrent(true)
      const res = await fetch(`/api/signatures?userId=${session.user.id}`)
      if (res.ok) {
        const signatures = await res.json()
        if (signatures.length > 0) {
          setCurrentSignature(signatures[0])
          // If signature type is not set, use the current signature's type
          if (!signatureType && signatures[0].signatureType) {
            setSignatureType(signatures[0].signatureType)
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch current signature:", error)
    } finally {
      setLoadingCurrent(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!imageFile || !signatureType) {
      alert("Please select a signature type and upload an image")
      return
    }

    setLoading(true)
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append("image", imageFile)
      formData.append("signatureType", signatureType)

      const res = await fetch("/api/signatures", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        // Refresh current signature
        await fetchCurrentSignature()
        // Clear form
        setImageFile(null)
        setPreview(null)
        // Reset file input
        const fileInput = document.getElementById("image") as HTMLInputElement
        if (fileInput) fileInput.value = ""
      } else {
        const error = await res.json()
        alert(error.error || "Failed to upload signature")
      }
    } catch (error) {
      console.error("Failed to upload signature:", error)
      alert("Failed to upload signature")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Signature Management</h1>
        <p className="text-muted-foreground">
          Upload your signature to appear on result reports
        </p>
      </div>

      {/* Current Signature Preview */}
      {currentSignature && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Current Signature
            </CardTitle>
            <CardDescription>
              Your currently saved signature ({currentSignature.signatureType.replace("_", " ")})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded p-4 bg-gray-50">
                <img
                  src={currentSignature.signatureImage}
                  alt="Current signature"
                  className="max-w-xs max-h-32 object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(currentSignature.updatedAt).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload Signature</CardTitle>
          <CardDescription>
            Upload a signature image that will appear on result reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="signatureType">Signature Type</Label>
              {session?.user.role === "PRINCIPAL" || session?.user.role === "TEACHER" ? (
                <div className="space-y-1">
                  <Input
                    value={signatureType === "PRINCIPAL" ? "Principal" : signatureType === "CLASS_TEACHER" ? "Class Teacher" : ""}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Signature type is automatically set based on your role
                  </p>
                </div>
              ) : (
                <Select
                  value={signatureType || ""}
                  onValueChange={setSignatureType}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select signature type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRINCIPAL">Principal</SelectItem>
                    <SelectItem value="CLASS_TEACHER">Class Teacher</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {!signatureType && (session?.user.role !== "PRINCIPAL" && session?.user.role !== "TEACHER") && (
                <p className="text-xs text-red-500">
                  Please select a signature type
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Signature Image</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                Upload a clear image of your signature (PNG, JPG, or JPEG recommended)
              </p>
            </div>

            {preview && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded p-4 bg-gray-50">
                  <img
                    src={preview}
                    alt="Signature preview"
                    className="max-w-xs max-h-32 object-contain"
                  />
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading || !imageFile || !signatureType}>
              {loading ? (
                "Uploading..."
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Signature
                </>
              )}
            </Button>

            {success && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Signature uploaded successfully!</span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

