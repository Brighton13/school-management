"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, CheckCircle, XCircle, AlertCircle, Upload } from "lucide-react"
import { useSession } from "next-auth/react"

interface ClassSubject {
  id: string
  class: { name: string }
  subject: { name: string; code: string }
}

interface Term {
  id: string
  name: string
  academicYear: string
}

interface Exam {
  id: string
  name: string
  examType: string
  isFinal: boolean
}

export function BulkResultsUpload() {
  const { data: session } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string>("")
  const [selectedTermId, setSelectedTermId] = useState<string>("")
  const [selectedExamId, setSelectedExamId] = useState<string>("")
  const [maxMarks, setMaxMarks] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedTermId) {
      fetchExams(selectedTermId)
    } else {
      setExams([])
      setSelectedExamId("")
    }
  }, [selectedTermId])

  const fetchData = async () => {
    try {
      const [classSubjectsRes, termsRes] = await Promise.all([
        fetch("/api/class-subjects"),
        fetch("/api/terms"),
      ])
      
      if (classSubjectsRes.ok) {
        const data = await classSubjectsRes.json()
        setClassSubjects(data)
      }
      
      if (termsRes.ok) {
        const data = await termsRes.json()
        setTerms(data)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExams = async (termId: string) => {
    try {
      const response = await fetch(`/api/exams?academicTermId=${termId}&status=ACTIVE`)
      if (response.ok) {
        const data = await response.json()
        setExams(data)
      }
    } catch (error) {
      console.error("Failed to fetch exams:", error)
      setExams([])
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/bulk/results")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "bulk_results_template.csv"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to download template:", error)
      alert("Failed to download template")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResults(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file")
      return
    }

    if (!selectedClassSubjectId || !selectedTermId || !maxMarks) {
      alert("Please select class-subject, academic term, and enter max marks")
      return
    }

    const parsedMaxMarks = parseFloat(maxMarks)
    if (isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
      alert("Please enter a valid max marks")
      return
    }

    setUploading(true)
    setResults(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("classSubjectId", selectedClassSubjectId)
      formData.append("academicTermId", selectedTermId)
      formData.append("maxMarks", maxMarks)
      if (selectedExamId && selectedExamId.trim() !== "") {
        formData.append("examId", selectedExamId)
      }

      const response = await fetch("/api/bulk/results", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResults(data)
        // Refresh the page data if upload was successful
        if (data.success > 0) {
          // Optionally trigger a refresh of results list
          window.dispatchEvent(new Event("resultsUpdated"))
        }
      } else {
        setResults({
          success: 0,
          failed: 0,
          errors: [data.error || "Upload failed"],
        })
      }
    } catch (error: any) {
      setResults({
        success: 0,
        failed: 0,
        errors: [error.message || "Upload failed"],
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Upload Results</CardTitle>
        <CardDescription>
          Upload results for multiple students at once. Select the class-subject, term, and exam, then upload a CSV file with student marks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="classSubject">Class & Subject *</Label>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : classSubjects.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2 border rounded">
              No class-subjects available. Please contact admin to assign you to subjects.
            </div>
          ) : (
            <Select 
              value={selectedClassSubjectId} 
              onValueChange={setSelectedClassSubjectId}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class and subject" />
              </SelectTrigger>
              <SelectContent>
                {classSubjects.map((cs) => (
                  <SelectItem key={cs.id} value={cs.id}>
                    {cs.class.name} - {cs.subject.name} ({cs.subject.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="term">Academic Term *</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <Select 
                value={selectedTermId} 
                onValueChange={setSelectedTermId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name} - {term.academicYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam">Exam (Optional)</Label>
            {!selectedTermId ? (
              <div className="text-sm text-muted-foreground">Select term first</div>
            ) : exams.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active exams for this term</div>
            ) : (
              <Select 
                value={selectedExamId || undefined} 
                onValueChange={setSelectedExamId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} ({exam.examType}) {exam.isFinal && "- Final"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxMarks">Max Marks *</Label>
          <Input
            id="maxMarks"
            type="number"
            step="0.01"
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
            placeholder="e.g., 100"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Upload CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>

        {file && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </div>
        )}

        {session?.user.role === "TEACHER" && (
          <div className="text-sm text-muted-foreground p-2 bg-blue-50 rounded">
            Results will be automatically sent to the class teacher for review and submission to principal.
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || !selectedClassSubjectId || !selectedTermId || !maxMarks || uploading}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading..." : "Upload Results"}
        </Button>

        {results && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">{results.success} successful</span>
              </div>
              {results.failed > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="font-semibold">{results.failed} failed</span>
                </div>
              )}
            </div>

            {results.errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-red-800">Errors:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 max-h-60 overflow-y-auto">
                  {results.errors.slice(0, 20).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {results.errors.length > 20 && (
                    <li className="text-red-600">
                      ... and {results.errors.length - 20} more errors
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

