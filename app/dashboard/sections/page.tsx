"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2 } from "lucide-react"

interface Section {
  id: string
  name: string
  classId: string
  capacity: number | null
  classTeacherId: string | null
  class: {
    id: string
    name: string
    level: number
  }
  classTeacher: {
    id: string
    user: {
      name: string
      email: string
    }
  } | null
  _count: {
    enrollments: number
  }
}

interface Class {
  id: string
  name: string
  level: number
}

interface Staff {
  id: string
  designation: string
  user: {
    name: string
    email: string
  }
}

export default function SectionsPage() {
  const [sections, setSections] = useState<Section[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
  // Form state for create dialog
  const [formClassId, setFormClassId] = useState<string>("")
  const [formClassTeacherId, setFormClassTeacherId] = useState<string>("")
  
  // Form state for edit dialog
  const [editFormClassId, setEditFormClassId] = useState<string>("")
  const [editFormClassTeacherId, setEditFormClassTeacherId] = useState<string>("")

  useEffect(() => {
    fetchSections()
    fetchClasses()
    fetchTeachers()
  }, [])

  const fetchSections = async () => {
    try {
      const res = await fetch("/api/sections")
      const data = await res.json()
      setSections(data)
    } catch (error) {
      console.error("Failed to fetch sections:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes")
      const data = await res.json()
      setClasses(data)
    } catch (error) {
      console.error("Failed to fetch classes:", error)
    }
  }

  const fetchTeachers = async () => {
    try {
      const res = await fetch("/api/staff")
      const data = await res.json()
      // Filter for teachers only
      const teacherStaff = data.filter((staff: Staff) => staff.designation === "TEACHER")
      setTeachers(teacherStaff)
    } catch (error) {
      console.error("Failed to fetch teachers:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    // Use state values for Select components, fallback to formData for inputs
    const classId = editingSection ? editFormClassId : formClassId
    const classTeacherId = editingSection ? editFormClassTeacherId : formClassTeacherId
    const name = formData.get("name") as string
    const capacityValue = formData.get("capacity") as string
    
    // Validation
    if (!name || !name.trim()) {
      alert("Please enter a section name")
      return
    }
    
    if (!classId) {
      alert("Please select a class")
      return
    }
    
    // Parse capacity - only if it has a value
    let capacity: number | null = null
    if (capacityValue && capacityValue.trim()) {
      const parsed = parseInt(capacityValue)
      if (!isNaN(parsed) && parsed > 0) {
        capacity = parsed
      }
    }
    
    const payload = {
      name: name.trim(),
      classId: classId,
      capacity: capacity,
      classTeacherId: classTeacherId || null,
    }
    
    console.log("Submitting section:", payload)
    
    try {
      const url = editingSection ? `/api/sections/${editingSection.id}` : "/api/sections"
      const method = editingSection ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      // Check response status first
      if (res.ok) {
        // Success - section was created/updated
        try {
          const responseData = await res.json()
          console.log("Section saved successfully:", responseData)
          
          // Reset form state
          setFormClassId("")
          setFormClassTeacherId("")
          setEditFormClassId("")
          setEditFormClassTeacherId("")
          setEditingSection(null)
          
          // Close dialogs
          setIsDialogOpen(false)
          setIsEditDialogOpen(false)
          
          // Reset form if it still exists
          if (e.currentTarget) {
            e.currentTarget.reset()
          }
          
          // Refresh sections list
          fetchSections()
        } catch (parseError) {
          console.error("Failed to parse success response:", parseError)
          // Even if parsing fails, the section was created, so refresh and close
          setIsDialogOpen(false)
          setIsEditDialogOpen(false)
          setEditingSection(null)
          setFormClassId("")
          setFormClassTeacherId("")
          setEditFormClassId("")
          setEditFormClassTeacherId("")
          fetchSections()
        }
      } else {
        // Error response
        try {
          const errorData = await res.json()
          console.error("Failed to save section:", errorData)
          alert(errorData.error || "Failed to save section")
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError)
          alert(`Failed to save section. Status: ${res.status}`)
        }
      }
    } catch (error) {
      console.error("Failed to save section:", error)
      alert("Failed to save section. Please check the console for details.")
    }
  }

  const handleEdit = async (section: Section) => {
    try {
      const res = await fetch(`/api/sections/${section.id}`)
      const data = await res.json()
      setEditingSection(data)
      setEditFormClassId(data.classId)
      setEditFormClassTeacherId(data.classTeacherId || "")
      setIsEditDialogOpen(true)
    } catch (error) {
      console.error("Failed to fetch section:", error)
    }
  }

  const handleDelete = async (sectionId: string) => {
    if (!confirm("Are you sure you want to delete this section? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchSections()
      }
    } catch (error) {
      console.error("Failed to delete section:", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sections</h1>
          <p className="text-muted-foreground">Manage class sections</p>
        </div>
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setFormClassId("")
              setFormClassTeacherId("")
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Section</DialogTitle>
              <DialogDescription>
                Create a new section for a class
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Section Name</Label>
                  <Input id="name" name="name" placeholder="e.g., A, B, Science" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classId">Class *</Label>
                  {classes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Loading classes...</div>
                  ) : (
                    <Select 
                      value={formClassId} 
                      onValueChange={(value) => {
                        console.log("Class selected:", value)
                        setFormClassId(value)
                      }}
                      required
                    >
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity (Optional)</Label>
                    <Input id="capacity" name="capacity" type="number" placeholder="Max students" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="classTeacherId">Class Teacher (Optional)</Label>
                    {teachers.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No teachers available</div>
                    ) : (
                      <Select 
                        value={formClassTeacherId || undefined} 
                        onValueChange={(value) => {
                          console.log("Teacher selected:", value)
                          setFormClassTeacherId(value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a teacher (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Section</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog 
        open={isEditDialogOpen} 
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            setEditingSection(null)
            setEditFormClassId("")
            setEditFormClassTeacherId("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>
              Update section information
            </DialogDescription>
          </DialogHeader>
          {editingSection && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Section Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingSection.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-classId">Class *</Label>
                  {classes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Loading classes...</div>
                  ) : (
                    <Select 
                      value={editFormClassId} 
                      onValueChange={(value) => {
                        console.log("Class selected (edit):", value)
                        setEditFormClassId(value)
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-capacity">Capacity (Optional)</Label>
                    <Input id="edit-capacity" name="capacity" type="number" defaultValue={editingSection.capacity || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-classTeacherId">Class Teacher (Optional)</Label>
                    {teachers.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No teachers available</div>
                    ) : (
                      <Select 
                        value={editFormClassTeacherId || undefined} 
                        onValueChange={(value) => {
                          console.log("Teacher selected (edit):", value)
                          setEditFormClassTeacherId(value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a teacher (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Update Section</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All Sections</CardTitle>
          <CardDescription>
            {sections.length} section(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Class Teacher</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No sections found. Create your first section to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  sections.map((section) => (
                    <TableRow key={section.id}>
                      <TableCell className="font-medium">{section.name}</TableCell>
                      <TableCell>{section.class.name}</TableCell>
                      <TableCell>{section.classTeacher?.user.name || "-"}</TableCell>
                      <TableCell>{section._count.enrollments}</TableCell>
                      <TableCell>
                        {section.capacity 
                          ? `${section._count.enrollments}/${section.capacity}` 
                          : "Unlimited"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(section)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(section.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

