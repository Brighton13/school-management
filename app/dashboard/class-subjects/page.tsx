"use client"

import { useEffect, useState } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Edit, Trash2, Users, BookOpen, GraduationCap, Layers } from "lucide-react"

interface ClassSubject {
  id: string
  class: { id: string; name: string }
  section: { id: string; name: string } | null
  subject: { id: string; name: string; code: string; type: string }
  teacher: {
    id: string
    user: { name: string }
    employeeId: string
  } | null
  maxMarks: number | null
  passMarks: number | null
}

interface Class {
  id: string
  name: string
}

interface Section {
  id: string
  name: string
  classId: string
  class: { name: string }
}

interface Subject {
  id: string
  name: string
  code: string
  type: string
}

interface Staff {
  id: string
  employeeId: string
  designation: string
  user: { name: string }
}

export default function ClassSubjectsPage() {
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [editingClassSubject, setEditingClassSubject] = useState<ClassSubject | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [filterClass, setFilterClass] = useState<string>("all")
  const [filterSection, setFilterSection] = useState<string>("all")
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [classSubjectsRes, classesRes, sectionsRes, subjectsRes, staffRes] = await Promise.all([
        fetch("/api/class-subjects"),
        fetch("/api/classes"),
        fetch("/api/sections"),
        fetch("/api/subjects"),
        fetch("/api/staff"),
      ])
      if (classSubjectsRes.status === 401 || classSubjectsRes.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (classSubjectsRes.ok) setClassSubjects(await classSubjectsRes.json())
      if (classesRes.ok) setClasses(await classesRes.json())
      if (sectionsRes.ok) setSections(await sectionsRes.json())
      if (subjectsRes.ok) setSubjects(await subjectsRes.json())
      if (staffRes.ok) {
        const staffData = await staffRes.json()
        // Filter to only show teachers
        setStaff(staffData.filter((s: Staff) => 
          ["TEACHER", "HEAD_TEACHER", "SENIOR_TEACHER"].includes(s.designation)
        ))
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Get sections for a specific class
  const getSectionsForClass = (classId: string) => {
    return sections.filter(s => s.classId === classId)
  }

  // Get subjects not yet assigned to a specific section
  const getAvailableSubjects = (classId: string, sectionId: string) => {
    const assignedSubjectIds = classSubjects
      .filter(cs => cs.class.id === classId && cs.section?.id === sectionId)
      .map(cs => cs.subject.id)
    return subjects.filter(s => !assignedSubjectIds.includes(s.id))
  }

  // Filter class subjects based on selected class and section
  const filteredClassSubjects = classSubjects.filter(cs => {
    if (filterClass !== "all" && cs.class.id !== filterClass) return false
    if (filterSection !== "all" && cs.section?.id !== filterSection) return false
    return true
  })

  // Debug: Log class subjects data
  useEffect(() => {
    if (classSubjects.length > 0) {
      console.log("All ClassSubjects:", classSubjects.map(cs => ({
        id: cs.id,
        className: cs.class.name,
        classId: cs.class.id,
        sectionName: cs.section?.name,
        sectionId: cs.section?.id,
        subjectName: cs.subject.name,
      })))
    }
  }, [classSubjects])

  // Group class subjects by class/section for overview
  const classSubjectsBySection = sections.map(section => {
    const sectionSubjects = classSubjects.filter(cs => cs.section?.id === section.id && cs.class.id === section.classId)
    console.log(`Section ${section.name} (id: ${section.id}, classId: ${section.classId}): ${sectionSubjects.length} subjects`)
    return {
      ...section,
      className: section.class.name,
      subjects: sectionSubjects,
      coreCount: sectionSubjects.filter(cs => cs.subject.type === "CORE").length,
      electiveCount: sectionSubjects.filter(cs => cs.subject.type === "ELECTIVE").length,
      optionalCount: sectionSubjects.filter(cs => cs.subject.type === "OPTIONAL").length,
    }
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const url = editingClassSubject ? `/api/class-subjects/${editingClassSubject.id}` : "/api/class-subjects"
      const method = editingClassSubject ? "PUT" : "POST"
      
      const teacherIdValue = formData.get("teacherId")
      const teacherId = teacherIdValue === "none" || !teacherIdValue ? null : teacherIdValue
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: formData.get("classId"),
          sectionId: formData.get("sectionId"),
          subjectId: formData.get("subjectId"),
          teacherId,
          maxMarks: formData.get("maxMarks") || null,
          passMarks: formData.get("passMarks") || null,
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingClassSubject(null)
        setSelectedClass("")
        setSelectedSection("")
        fetchData()
        e.currentTarget.reset()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to save class subject")
      }
    } catch (error) {
      console.error("Failed to save class subject:", error)
      alert("Failed to save class subject")
    }
  }

  const handleBulkAssign = async () => {
    if (!selectedClass || !selectedSection || selectedSubjects.length === 0) {
      alert("Please select a class, section, and at least one subject")
      return
    }

    try {
      let successCount = 0
      let failCount = 0

      for (const subjectId of selectedSubjects) {
        const res = await fetch("/api/class-subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: selectedClass,
            sectionId: selectedSection,
            subjectId,
            maxMarks: 100,
            passMarks: 40,
          }),
        })

        if (res.ok) {
          successCount++
        } else {
          failCount++
        }
      }

      setIsBulkDialogOpen(false)
      setSelectedClass("")
      setSelectedSection("")
      setSelectedSubjects([])
      fetchData()
      alert(`Successfully assigned ${successCount} subjects. ${failCount > 0 ? `Failed: ${failCount}` : ''}`)
    } catch (error) {
      console.error("Failed to bulk assign:", error)
      alert("Failed to bulk assign subjects")
    }
  }

  const handleEdit = async (classSubject: ClassSubject) => {
    setEditingClassSubject(classSubject)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (classSubjectId: string) => {
    if (!confirm("Are you sure you want to delete this class-subject? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/class-subjects/${classSubjectId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchData()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to delete")
      }
    } catch (error) {
      console.error("Failed to delete class subject:", error)
    }
  }

  const getSubjectTypeBadge = (type: string) => {
    const config: Record<string, { color: string; label: string }> = {
      CORE: { color: "bg-blue-100 text-blue-800", label: "Core" },
      ELECTIVE: { color: "bg-purple-100 text-purple-800", label: "Elective" },
      OPTIONAL: { color: "bg-orange-100 text-orange-800", label: "Optional" },
    }
    const { color, label } = config[type] || config.CORE
    return <Badge className={color}>{label}</Badge>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Class Subject Management</h1>
          <p className="text-muted-foreground">Assign subjects to classes and manage teacher allocations</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Layers className="mr-2 h-4 w-4" />
                Bulk Assign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Assign Subjects to Section</DialogTitle>
                <DialogDescription>
                  Select a class, section, and multiple subjects to assign at once
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Class</Label>
                    <Select value={selectedClass} onValueChange={(value) => {
                      setSelectedClass(value)
                      setSelectedSection("")
                      setSelectedSubjects([])
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Select Section</Label>
                    <Select 
                      value={selectedSection} 
                      onValueChange={(value) => {
                        setSelectedSection(value)
                        setSelectedSubjects([])
                      }}
                      disabled={!selectedClass}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedClass ? "Choose a section" : "Select class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {getSectionsForClass(selectedClass).map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedClass && selectedSection && (
                  <div className="space-y-2">
                    <Label>Select Subjects</Label>
                    <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                      {getAvailableSubjects(selectedClass, selectedSection).length === 0 ? (
                        <p className="text-muted-foreground text-sm">All subjects are already assigned to this section</p>
                      ) : (
                        getAvailableSubjects(selectedClass, selectedSection).map((subject) => (
                          <div key={subject.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={subject.id}
                              checked={selectedSubjects.includes(subject.id)}
                              onCheckedChange={(checked: boolean | "indeterminate") => {
                                if (checked === true) {
                                  setSelectedSubjects([...selectedSubjects, subject.id])
                                } else {
                                  setSelectedSubjects(selectedSubjects.filter(id => id !== subject.id))
                                }
                              }}
                            />
                            <label htmlFor={subject.id} className="flex items-center gap-2 cursor-pointer flex-1">
                              <span>{subject.name}</span>
                              <span className="text-muted-foreground text-sm">({subject.code})</span>
                              {getSubjectTypeBadge(subject.type)}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedSubjects.length} subject(s) selected
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAssign} disabled={!selectedClass || !selectedSection || selectedSubjects.length === 0}>
                  Assign {selectedSubjects.length} Subject(s)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setSelectedClass("")
              setSelectedSection("")
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Single Assignment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Class Subject</DialogTitle>
                <DialogDescription>
                  Assign a subject to a class section with optional teacher
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="classId">Class</Label>
                      <Select 
                        name="classId" 
                        value={selectedClass}
                        onValueChange={(value) => {
                          setSelectedClass(value)
                          setSelectedSection("")
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sectionId">Section</Label>
                      <Select 
                        name="sectionId" 
                        value={selectedSection}
                        onValueChange={setSelectedSection}
                        required
                        disabled={!selectedClass}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={selectedClass ? "Select section" : "Select class first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {getSectionsForClass(selectedClass).map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subjectId">Subject</Label>
                    <Select name="subjectId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            <div className="flex items-center gap-2">
                              {subject.name} ({subject.code})
                              {getSubjectTypeBadge(subject.type)}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacherId">Teacher (Optional)</Label>
                    <Select name="teacherId">
                      <SelectTrigger>
                        <SelectValue placeholder="Assign teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.user.name} ({teacher.employeeId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxMarks">Max Marks</Label>
                      <Input id="maxMarks" name="maxMarks" type="number" step="0.01" defaultValue="100" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passMarks">Pass Marks</Label>
                      <Input id="passMarks" name="passMarks" type="number" step="0.01" defaultValue="40" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <GraduationCap className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="details">
            <BookOpen className="h-4 w-4 mr-2" />
            Detailed View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {classSubjectsBySection.map((section) => (
              <Card key={section.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    {section.className} - {section.name}
                  </CardTitle>
                  <CardDescription>
                    {section.subjects.length} subject(s) assigned
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap mb-4">
                    <Badge variant="outline" className="bg-blue-50">
                      Core: {section.coreCount}
                    </Badge>
                    <Badge variant="outline" className="bg-purple-50">
                      Elective: {section.electiveCount}
                    </Badge>
                    <Badge variant="outline" className="bg-orange-50">
                      Optional: {section.optionalCount}
                    </Badge>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {section.subjects.slice(0, 5).map((cs) => (
                      <div key={cs.id} className="flex items-center justify-between text-sm">
                        <span>{cs.subject.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {cs.teacher?.user.name || "No teacher"}
                        </span>
                      </div>
                    ))}
                    {section.subjects.length > 5 && (
                      <p className="text-muted-foreground text-xs">
                        +{section.subjects.length - 5} more...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>All Class Subjects</CardTitle>
                  <CardDescription>
                    {filteredClassSubjects.length} assignment(s) found
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filterClass} onValueChange={(value) => {
                    setFilterClass(value)
                    setFilterSection("all")
                  }}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select 
                    value={filterSection} 
                    onValueChange={setFilterSection}
                    disabled={filterClass === "all"}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {(filterClass === "all" ? sections : getSectionsForClass(filterClass)).map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Max Marks</TableHead>
                        <TableHead>Pass Marks</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClassSubjects.map((cs) => (
                        <TableRow key={cs.id}>
                          <TableCell className="font-medium">{cs.class.name}</TableCell>
                          <TableCell>{cs.section?.name || "-"}</TableCell>
                          <TableCell>
                            {cs.subject.name}
                            <span className="text-muted-foreground ml-1">({cs.subject.code})</span>
                          </TableCell>
                          <TableCell>{getSubjectTypeBadge(cs.subject.type)}</TableCell>
                          <TableCell>
                            {cs.teacher ? (
                              <div>
                                <div className="font-medium">{cs.teacher.user.name}</div>
                                <div className="text-xs text-muted-foreground">{cs.teacher.employeeId}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>{cs.maxMarks || "-"}</TableCell>
                          <TableCell>{cs.passMarks || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(cs)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(cs.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class Subject</DialogTitle>
            <DialogDescription>
              Update teacher assignment and marks settings
            </DialogDescription>
          </DialogHeader>
          {editingClassSubject && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{editingClassSubject.class.name} - {editingClassSubject.section?.name || "No Section"}</p>
                  <p className="text-sm text-muted-foreground">
                    {editingClassSubject.subject.name} ({editingClassSubject.subject.code})
                  </p>
                </div>
                <input type="hidden" name="classId" value={editingClassSubject.class.id} />
                <input type="hidden" name="sectionId" value={editingClassSubject.section?.id || ""} />
                <input type="hidden" name="subjectId" value={editingClassSubject.subject.id} />
                <div className="space-y-2">
                  <Label htmlFor="edit-teacherId">Teacher</Label>
                  <Select name="teacherId" defaultValue={editingClassSubject.teacher?.id || "none"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No teacher</SelectItem>
                      {staff.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.user.name} ({teacher.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-maxMarks">Max Marks</Label>
                    <Input 
                      id="edit-maxMarks" 
                      name="maxMarks" 
                      type="number" 
                      step="0.01" 
                      defaultValue={editingClassSubject.maxMarks || ""} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-passMarks">Pass Marks</Label>
                    <Input 
                      id="edit-passMarks" 
                      name="passMarks" 
                      type="number" 
                      step="0.01" 
                      defaultValue={editingClassSubject.passMarks || ""} 
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Update</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

