"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Save, 
  Upload, 
  Trash2, 
  Plus, 
  School, 
  FileSignature, 
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Hash
} from "lucide-react"

interface SchoolConfig {
  id: string
  schoolName: string
  schoolMotto: string | null
  schoolAddress: string | null
  schoolPhone: string | null
  schoolEmail: string | null
  schoolLogo: string | null
  ministryHeader: string | null
  principalName: string | null
  principalSignature: string | null
  reportFooterText: string | null
  nextTermDate: string | null
}

interface RemarkTemplate {
  id?: string
  minPercentage: number
  maxPercentage: number
  remark: string
  category: string
}

interface CommentTemplate {
  id?: string
  minPercentage: number
  maxPercentage: number
  comment: string
  commentType: string
}

interface PointsConfig {
  id?: string
  minPercentage: number
  maxPercentage: number
  points: number
  description: string
}

interface Signature {
  id: string
  userId: string
  signatureType: string | null
  signatureImage: string
  user: {
    id: string
    name: string
    role: string
  }
}

export default function ReportConfigPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("school")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // School config state
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>({
    id: "",
    schoolName: "",
    schoolMotto: "",
    schoolAddress: "",
    schoolPhone: "",
    schoolEmail: "",
    schoolLogo: null,
    ministryHeader: "MINISTRY OF EDUCATION",
    principalName: "",
    principalSignature: null,
    reportFooterText: "",
    nextTermDate: null,
  })

  // Signature state
  const [mySignature, setMySignature] = useState<Signature | null>(null)
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Remark templates state
  const [remarkTemplates, setRemarkTemplates] = useState<RemarkTemplate[]>([
    { minPercentage: 90, maxPercentage: 100, remark: "Excellent", category: "SUBJECT" },
    { minPercentage: 80, maxPercentage: 89, remark: "Very Good", category: "SUBJECT" },
    { minPercentage: 70, maxPercentage: 79, remark: "Good", category: "SUBJECT" },
    { minPercentage: 60, maxPercentage: 69, remark: "Satisfactory", category: "SUBJECT" },
    { minPercentage: 50, maxPercentage: 59, remark: "Fair", category: "SUBJECT" },
    { minPercentage: 40, maxPercentage: 49, remark: "Pass", category: "SUBJECT" },
    { minPercentage: 0, maxPercentage: 39, remark: "Fail", category: "SUBJECT" },
  ])

  // Comment templates state
  const [teacherComments, setTeacherComments] = useState<CommentTemplate[]>([
    { minPercentage: 90, maxPercentage: 100, comment: "Excellent work. Keep it up!", commentType: "CLASS_TEACHER" },
    { minPercentage: 80, maxPercentage: 89, comment: "Very good performance. Well done!", commentType: "CLASS_TEACHER" },
    { minPercentage: 70, maxPercentage: 79, comment: "Good work. Continue improving.", commentType: "CLASS_TEACHER" },
    { minPercentage: 60, maxPercentage: 69, comment: "Satisfactory. More effort needed.", commentType: "CLASS_TEACHER" },
    { minPercentage: 50, maxPercentage: 59, comment: "Fair performance. Work harder.", commentType: "CLASS_TEACHER" },
    { minPercentage: 40, maxPercentage: 49, comment: "Needs improvement. Seek help.", commentType: "CLASS_TEACHER" },
    { minPercentage: 0, maxPercentage: 39, comment: "Poor performance. Requires attention.", commentType: "CLASS_TEACHER" },
  ])

  const [principalComments, setPrincipalComments] = useState<CommentTemplate[]>([
    { minPercentage: 90, maxPercentage: 100, comment: "Outstanding achievement. The school is proud of you!", commentType: "PRINCIPAL" },
    { minPercentage: 80, maxPercentage: 89, comment: "Very good academic performance. Maintain high standards.", commentType: "PRINCIPAL" },
    { minPercentage: 70, maxPercentage: 79, comment: "Good progress. Continue working hard.", commentType: "PRINCIPAL" },
    { minPercentage: 60, maxPercentage: 69, comment: "Satisfactory results. More dedication required.", commentType: "PRINCIPAL" },
    { minPercentage: 50, maxPercentage: 59, comment: "Fair performance. Improvement expected.", commentType: "PRINCIPAL" },
    { minPercentage: 40, maxPercentage: 49, comment: "Below expectations. Extra effort needed.", commentType: "PRINCIPAL" },
    { minPercentage: 0, maxPercentage: 39, comment: "Unsatisfactory. Parent consultation recommended.", commentType: "PRINCIPAL" },
  ])

  // Points configuration state (for final exams)
  const [pointsConfig, setPointsConfig] = useState<PointsConfig[]>([
    { minPercentage: 75, maxPercentage: 100, points: 1, description: "Distinction" },
    { minPercentage: 65, maxPercentage: 74, points: 2, description: "Merit" },
    { minPercentage: 50, maxPercentage: 64, points: 3, description: "Credit" },
    { minPercentage: 40, maxPercentage: 49, points: 4, description: "Pass" },
    { minPercentage: 30, maxPercentage: 39, points: 5, description: "Satisfactory" },
    { minPercentage: 1, maxPercentage: 29, points: 6, description: "Poor" },
    { minPercentage: 0, maxPercentage: 0, points: 7, description: "Fail" },
  ])

  const logoInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch school config
      const configRes = await fetch("/api/settings/school-config")
      if (configRes.ok) {
        const data = await configRes.json()
        setSchoolConfig(data)
      }

      // Fetch remark templates
      const remarksRes = await fetch("/api/settings/remark-templates?category=SUBJECT")
      if (remarksRes.ok) {
        const data = await remarksRes.json()
        if (data.length > 0) {
          setRemarkTemplates(data)
        }
      }

      // Fetch teacher comment templates
      const teacherCommentsRes = await fetch("/api/settings/comment-templates?commentType=CLASS_TEACHER")
      if (teacherCommentsRes.ok) {
        const data = await teacherCommentsRes.json()
        if (data.length > 0) {
          setTeacherComments(data)
        }
      }

      // Fetch principal comment templates
      const principalCommentsRes = await fetch("/api/settings/comment-templates?commentType=PRINCIPAL")
      if (principalCommentsRes.ok) {
        const data = await principalCommentsRes.json()
        if (data.length > 0) {
          setPrincipalComments(data)
        }
      }

      // Fetch my signature
      const sigRes = await fetch("/api/settings/signatures")
      if (sigRes.ok) {
        const data = await sigRes.json()
        setMySignature(data)
      }

      // Fetch points configuration
      const pointsRes = await fetch("/api/settings/points-config")
      if (pointsRes.ok) {
        const data = await pointsRes.json()
        if (data.length > 0) {
          setPointsConfig(data)
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "schoolLogo" | "principalSignature" | "signature"
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      if (field === "signature") {
        // Handle signature upload separately
        saveSignature(base64)
      } else {
        setSchoolConfig(prev => ({ ...prev, [field]: base64 }))
      }
    }
    reader.readAsDataURL(file)
  }

  const saveSignature = async (signatureImage: string) => {
    try {
      const res = await fetch("/api/settings/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureImage,
          signatureType: session?.user.role === "PRINCIPAL" ? "PRINCIPAL" : "CLASS_TEACHER",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMySignature(data.signature)
        setMessage({ type: "success", text: "Signature saved successfully" })
      } else {
        setMessage({ type: "error", text: "Failed to save signature" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save signature" })
    }
  }

  const saveSchoolConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/school-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolConfig),
      })

      if (res.ok) {
        setMessage({ type: "success", text: "School configuration saved successfully" })
      } else {
        setMessage({ type: "error", text: "Failed to save school configuration" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save school configuration" })
    } finally {
      setSaving(false)
    }
  }

  const saveRemarkTemplates = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/remark-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: remarkTemplates }),
      })

      if (res.ok) {
        setMessage({ type: "success", text: "Remark templates saved successfully" })
      } else {
        setMessage({ type: "error", text: "Failed to save remark templates" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save remark templates" })
    } finally {
      setSaving(false)
    }
  }

  const saveCommentTemplates = async (type: "CLASS_TEACHER" | "PRINCIPAL") => {
    setSaving(true)
    try {
      const templates = type === "CLASS_TEACHER" ? teacherComments : principalComments
      const res = await fetch("/api/settings/comment-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates, commentType: type }),
      })

      if (res.ok) {
        setMessage({ type: "success", text: "Comment templates saved successfully" })
      } else {
        setMessage({ type: "error", text: "Failed to save comment templates" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save comment templates" })
    } finally {
      setSaving(false)
    }
  }

  const updateRemarkTemplate = (index: number, field: keyof RemarkTemplate, value: any) => {
    const updated = [...remarkTemplates]
    updated[index] = { ...updated[index], [field]: value }
    setRemarkTemplates(updated)
  }

  const addRemarkTemplate = () => {
    setRemarkTemplates([
      ...remarkTemplates,
      { minPercentage: 0, maxPercentage: 0, remark: "", category: "SUBJECT" },
    ])
  }

  const removeRemarkTemplate = (index: number) => {
    setRemarkTemplates(remarkTemplates.filter((_, i) => i !== index))
  }

  const updateCommentTemplate = (
    type: "CLASS_TEACHER" | "PRINCIPAL",
    index: number,
    field: keyof CommentTemplate,
    value: any
  ) => {
    if (type === "CLASS_TEACHER") {
      const updated = [...teacherComments]
      updated[index] = { ...updated[index], [field]: value }
      setTeacherComments(updated)
    } else {
      const updated = [...principalComments]
      updated[index] = { ...updated[index], [field]: value }
      setPrincipalComments(updated)
    }
  }

  const addCommentTemplate = (type: "CLASS_TEACHER" | "PRINCIPAL") => {
    const newTemplate = { minPercentage: 0, maxPercentage: 0, comment: "", commentType: type }
    if (type === "CLASS_TEACHER") {
      setTeacherComments([...teacherComments, newTemplate])
    } else {
      setPrincipalComments([...principalComments, newTemplate])
    }
  }

  const removeCommentTemplate = (type: "CLASS_TEACHER" | "PRINCIPAL", index: number) => {
    if (type === "CLASS_TEACHER") {
      setTeacherComments(teacherComments.filter((_, i) => i !== index))
    } else {
      setPrincipalComments(principalComments.filter((_, i) => i !== index))
    }
  }

  // Points configuration functions
  const updatePointsConfig = (index: number, field: keyof PointsConfig, value: any) => {
    const updated = [...pointsConfig]
    updated[index] = { ...updated[index], [field]: value }
    setPointsConfig(updated)
  }

  const addPointsConfig = () => {
    setPointsConfig([
      ...pointsConfig,
      { minPercentage: 0, maxPercentage: 0, points: 1, description: "" },
    ])
  }

  const removePointsConfig = (index: number) => {
    setPointsConfig(pointsConfig.filter((_, i) => i !== index))
  }

  const savePointsConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/points-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: pointsConfig }),
      })

      if (res.ok) {
        const data = await res.json()
        setPointsConfig(data)
        setMessage({ type: "success", text: "Points configuration saved successfully" })
      } else {
        const error = await res.json()
        setMessage({ type: "error", text: error.error || "Failed to save points configuration" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save points configuration" })
    } finally {
      setSaving(false)
    }
  }

  // Signature canvas functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    
    setIsDrawing(true)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      const rect = canvas.getBoundingClientRect()
      ctx.beginPath()
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (ctx) {
      const rect = canvas.getBoundingClientRect()
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const saveCanvasSignature = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    saveSignature(dataUrl)
  }

  if (!["ADMIN", "PRINCIPAL", "CLASS_TEACHER", "TEACHER"].includes(session?.user.role || "")) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (permissionDenied) {
    return (
      <PermissionDenied 
        title="Access Denied"
        message="You don't have permission to access this page. Please contact your administrator if you believe this is an error."
      />
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Report Configuration</h1>
        <p className="text-muted-foreground">
          Configure school settings, signatures, and comment templates for report cards
        </p>
      </div>

      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertTitle>{message.type === "error" ? "Error" : "Success"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {["ADMIN", "PRINCIPAL"].includes(session?.user.role || "") && (
            <TabsTrigger value="school">
              <School className="h-4 w-4 mr-2" />
              School Settings
            </TabsTrigger>
          )}
          <TabsTrigger value="signature">
            <FileSignature className="h-4 w-4 mr-2" />
            My Signature
          </TabsTrigger>
          {["ADMIN", "PRINCIPAL"].includes(session?.user.role || "") && (
            <>
              <TabsTrigger value="remarks">
                <MessageSquare className="h-4 w-4 mr-2" />
                Remark Templates
              </TabsTrigger>
              <TabsTrigger value="comments">
                <MessageSquare className="h-4 w-4 mr-2" />
                Comment Templates
              </TabsTrigger>
              <TabsTrigger value="points">
                <Hash className="h-4 w-4 mr-2" />
                Points Config
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* School Settings Tab */}
        <TabsContent value="school" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>
                Configure your school's basic information that appears on report cards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ministry Header</Label>
                  <Input
                    value={schoolConfig.ministryHeader || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, ministryHeader: e.target.value })}
                    placeholder="e.g., MINISTRY OF EDUCATION"
                  />
                </div>
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input
                    value={schoolConfig.schoolName}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, schoolName: e.target.value })}
                    placeholder="Enter school name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>School Motto</Label>
                  <Input
                    value={schoolConfig.schoolMotto || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, schoolMotto: e.target.value })}
                    placeholder="Enter school motto"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Principal Name</Label>
                  <Input
                    value={schoolConfig.principalName || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, principalName: e.target.value })}
                    placeholder="Enter principal name"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>School Address</Label>
                  <Textarea
                    value={schoolConfig.schoolAddress || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, schoolAddress: e.target.value })}
                    placeholder="Enter school address"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>School Phone</Label>
                  <Input
                    value={schoolConfig.schoolPhone || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, schoolPhone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>School Email</Label>
                  <Input
                    type="email"
                    value={schoolConfig.schoolEmail || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, schoolEmail: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Next Term Date</Label>
                  <Input
                    type="date"
                    value={schoolConfig.nextTermDate?.split("T")[0] || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, nextTermDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Report Footer Text</Label>
                  <Input
                    value={schoolConfig.reportFooterText || ""}
                    onChange={(e) => setSchoolConfig({ ...schoolConfig, reportFooterText: e.target.value })}
                    placeholder="Footer text for report cards"
                  />
                </div>
              </div>

              {/* School Logo */}
              <div className="space-y-2">
                <Label>School Logo / Coat of Arms</Label>
                <div className="flex items-center gap-4">
                  {schoolConfig.schoolLogo ? (
                    <div className="relative">
                      <img
                        src={schoolConfig.schoolLogo}
                        alt="School Logo"
                        className="h-24 w-24 object-contain border rounded"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                        onClick={() => setSchoolConfig({ ...schoolConfig, schoolLogo: null })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-24 w-24 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      ref={logoInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, "schoolLogo")}
                    />
                    <Button variant="outline" onClick={() => logoInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: PNG with transparent background, 200x200px
                    </p>
                  </div>
                </div>
              </div>

              {/* Principal Signature for School Config */}
              <div className="space-y-2">
                <Label>Principal Signature (for Report Footer)</Label>
                <div className="flex items-center gap-4">
                  {schoolConfig.principalSignature ? (
                    <div className="relative">
                      <img
                        src={schoolConfig.principalSignature}
                        alt="Principal Signature"
                        className="h-16 w-40 object-contain border rounded bg-white"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0"
                        onClick={() => setSchoolConfig({ ...schoolConfig, principalSignature: null })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-16 w-40 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                      <FileSignature className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      ref={signatureInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, "principalSignature")}
                    />
                    <Button variant="outline" onClick={() => signatureInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Signature
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG with transparent background recommended
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={saveSchoolConfig} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save School Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Signature Tab */}
        <TabsContent value="signature" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>My Signature</CardTitle>
              <CardDescription>
                Upload or draw your signature to be used on report cards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mySignature ? (
                <div className="space-y-4">
                  <div>
                    <Label>Current Signature</Label>
                    <div className="mt-2 p-4 border rounded bg-white inline-block">
                      <img
                        src={mySignature.signatureImage}
                        alt="My Signature"
                        className="h-20 object-contain"
                      />
                    </div>
                    <Badge className="ml-2">{mySignature.signatureType || "Not specified"}</Badge>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await fetch("/api/settings/signatures", { method: "DELETE" })
                      setMySignature(null)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Signature
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">No signature uploaded yet</p>
              )}

              <div className="border-t pt-4">
                <Label>Upload New Signature</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "signature")}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <Label>Or Draw Your Signature</Label>
                <div className="mt-2 border rounded p-2 bg-white inline-block">
                  <canvas
                    ref={signatureCanvasRef}
                    width={400}
                    height={150}
                    className="border cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={clearCanvas}>
                    Clear
                  </Button>
                  <Button onClick={saveCanvasSignature}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Drawn Signature
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remark Templates Tab */}
        <TabsContent value="remarks" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Subject Remark Templates</CardTitle>
              <CardDescription>
                Configure automatic remarks based on percentage ranges (e.g., 90-100% = "Excellent")
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Min %</TableHead>
                    <TableHead>Max %</TableHead>
                    <TableHead>Remark</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remarkTemplates.map((template, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={template.minPercentage}
                          onChange={(e) => updateRemarkTemplate(index, "minPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={template.maxPercentage}
                          onChange={(e) => updateRemarkTemplate(index, "maxPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={template.remark}
                          onChange={(e) => updateRemarkTemplate(index, "remark", e.target.value)}
                          placeholder="Enter remark"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRemarkTemplate(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={addRemarkTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
                <Button onClick={saveRemarkTemplates} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Remark Templates"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comment Templates Tab */}
        <TabsContent value="comments" className="space-y-6 mt-4">
          {/* Class Teacher Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Class Teacher Comment Templates</CardTitle>
              <CardDescription>
                Auto-generated comments from class teacher based on overall percentage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Min %</TableHead>
                    <TableHead>Max %</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherComments.map((template, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={template.minPercentage}
                          onChange={(e) => updateCommentTemplate("CLASS_TEACHER", index, "minPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={template.maxPercentage}
                          onChange={(e) => updateCommentTemplate("CLASS_TEACHER", index, "maxPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={template.comment}
                          onChange={(e) => updateCommentTemplate("CLASS_TEACHER", index, "comment", e.target.value)}
                          placeholder="Enter comment"
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCommentTemplate("CLASS_TEACHER", index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => addCommentTemplate("CLASS_TEACHER")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
                <Button onClick={() => saveCommentTemplates("CLASS_TEACHER")} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Teacher Comments"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Principal Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Principal/Head Teacher Comment Templates</CardTitle>
              <CardDescription>
                Auto-generated comments from principal based on overall percentage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Min %</TableHead>
                    <TableHead>Max %</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {principalComments.map((template, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={template.minPercentage}
                          onChange={(e) => updateCommentTemplate("PRINCIPAL", index, "minPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={template.maxPercentage}
                          onChange={(e) => updateCommentTemplate("PRINCIPAL", index, "maxPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={template.comment}
                          onChange={(e) => updateCommentTemplate("PRINCIPAL", index, "comment", e.target.value)}
                          placeholder="Enter comment"
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCommentTemplate("PRINCIPAL", index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => addCommentTemplate("PRINCIPAL")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
                <Button onClick={() => saveCommentTemplates("PRINCIPAL")} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Principal Comments"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Configuration Tab */}
        <TabsContent value="points" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Points Configuration (Final Exams)</CardTitle>
              <CardDescription>
                Configure the points system for final/end-of-term exams. Points are calculated based on 
                percentage ranges and displayed on reports. Lower points indicate better performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  Points are only shown on reports for exams marked as "Final" or "End of Term". 
                  Each subject's percentage is converted to points based on these ranges.
                  Example: A student scoring 85% gets 1 point (if 75-100% = 1 point).
                </AlertDescription>
              </Alert>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Min %</TableHead>
                    <TableHead className="w-28">Max %</TableHead>
                    <TableHead className="w-24">Points</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointsConfig.map((config, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={config.minPercentage}
                          onChange={(e) => updatePointsConfig(index, "minPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={config.maxPercentage}
                          onChange={(e) => updatePointsConfig(index, "maxPercentage", Number(e.target.value))}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={config.points}
                          onChange={(e) => updatePointsConfig(index, "points", Number(e.target.value))}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={config.description}
                          onChange={(e) => updatePointsConfig(index, "description", e.target.value)}
                          placeholder="e.g., Distinction, Merit, Credit"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePointsConfig(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={addPointsConfig}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
                <Button onClick={savePointsConfig} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Points Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
