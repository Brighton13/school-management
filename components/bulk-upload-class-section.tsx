"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface Class {
  id: string
  name: string
  level: number
}

interface Section {
  id: string
  name: string
  classId: string
}

export function BulkUploadClassSection() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [classes, setClasses] = useState<Class[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [academicYear, setAcademicYear] = useState<string>("")
  const [term, setTerm] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)

  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    if (selectedClassId) {
      fetchSections(selectedClassId)
    } else {
      setSections([])
      setSelectedSectionId("")
    }
  }, [selectedClassId])

  const fetchClasses = async () => {
    try {
      const response = await fetch("/api/classes")
      const data = await response.json()
      setClasses(data)
    } catch (error) {
      console.error("Failed to fetch classes:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSections = async (classId: string) => {
    try {
      const response = await fetch(`/api/sections?classId=${classId}`)
      const data = await response.json()
      setSections(data)
    } catch (error) {
      console.error("Failed to fetch sections:", error)
      setSections([])
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/bulk/enrollment-class-section")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "class_section_enrollment_template.csv"
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

    if (!selectedClassId || !selectedSectionId) {
      alert("Please select a class and section")
      return
    }

    if (!academicYear || !term) {
      alert("Please enter academic year and term")
      return
    }

    setUploading(true)
    setResults(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("classId", selectedClassId)
      formData.append("sectionId", selectedSectionId)
      formData.append("academicYear", academicYear)
      formData.append("term", term)

      const response = await fetch("/api/bulk/enrollment-class-section", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResults(data)
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
        <CardTitle>Bulk Enroll Students in Class & Section</CardTitle>
        <CardDescription>
          Select a class and section, then upload a CSV file with student admission numbers to enroll them all in the same class and section.
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="class">Class *</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading classes...</div>
            ) : (
              <Select value={selectedClassId} onValueChange={setSelectedClassId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} (Level {cls.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="section">Section *</Label>
            {!selectedClassId ? (
              <div className="text-sm text-muted-foreground">Select a class first</div>
            ) : sections.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sections available for this class</div>
            ) : (
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="academicYear">Academic Year *</Label>
            <Input
              id="academicYear"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="e.g., 2024-2025"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="term">Term *</Label>
            <Input
              id="term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g., First Term"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Upload CSV File (with Admission Numbers)</label>
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

        <Button
          onClick={handleUpload}
          disabled={!file || !selectedClassId || !selectedSectionId || !academicYear || !term || uploading}
          className="w-full"
        >
          {uploading ? "Uploading..." : "Upload & Enroll Students"}
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
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  {results.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {results.errors.length > 10 && (
                    <li className="text-red-600">
                      ... and {results.errors.length - 10} more errors
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

