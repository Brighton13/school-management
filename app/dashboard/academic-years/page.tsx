"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Pencil, Trash2, Calendar, CheckCircle, Clock, Archive, ChevronDown, ChevronRight } from "lucide-react"
import { formatDate } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"

interface Term {
  id: string
  name: string
  termNumber: number
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface AcademicYear {
  id: string
  year: string
  startDate: string
  endDate: string
  isCurrent: boolean
  isUpcoming: boolean
  status: string
  terms: Term[]
  _count: {
    enrollments: number
    applications: number
    results: number
    fees: number
  }
}

export default function AcademicYearsPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [isYearDialogOpen, setIsYearDialogOpen] = useState(false)
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false)
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [selectedYearForTerm, setSelectedYearForTerm] = useState<AcademicYear | null>(null)
  const [deletingYear, setDeletingYear] = useState<AcademicYear | null>(null)
  const [deletingTerm, setDeletingTerm] = useState<{ term: Term; yearId: string } | null>(null)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [settingCurrent, setSettingCurrent] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchAcademicYears()
  }, [])

  const fetchAcademicYears = async () => {
    try {
      const res = await fetch("/api/academic-years")
      const data = await res.json()
      setAcademicYears(data)
      // Auto-expand current year
      const currentYear = data.find((y: AcademicYear) => y.isCurrent)
      if (currentYear) {
        setExpandedYears(new Set([currentYear.id]))
      }
    } catch (error) {
      console.error("Failed to fetch academic years:", error)
      toast({
        title: "Error",
        description: "Failed to fetch academic years",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleYearSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const url = editingYear ? `/api/academic-years/${editingYear.id}` : "/api/academic-years"
      const method = editingYear ? "PATCH" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: formData.get("year"),
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
          isCurrent: formData.get("isCurrent") === "on",
          isUpcoming: formData.get("isUpcoming") === "on",
          status: formData.get("status"),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setIsYearDialogOpen(false)
        setEditingYear(null)
        fetchAcademicYears()
        toast({
          title: editingYear ? "Academic year updated" : "Academic year created",
          description: editingYear 
            ? "Academic year has been updated successfully." 
            : "Academic year has been created successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save academic year",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to save academic year:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const handleTermSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    if (!selectedYearForTerm) return

    try {
      const url = editingTerm 
        ? `/api/terms/${editingTerm.id}` 
        : `/api/academic-years/${selectedYearForTerm.id}/terms`
      const method = editingTerm ? "PATCH" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          termNumber: parseInt(formData.get("termNumber") as string),
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
          isCurrent: formData.get("isCurrent") === "on",
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setIsTermDialogOpen(false)
        setEditingTerm(null)
        setSelectedYearForTerm(null)
        fetchAcademicYears()
        toast({
          title: editingTerm ? "Term updated" : "Term created",
          description: editingTerm 
            ? "Term has been updated successfully." 
            : "Term has been created successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save term",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to save term:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const handleSetCurrent = async (yearId: string) => {
    setSettingCurrent(yearId)
    try {
      const res = await fetch(`/api/academic-years/${yearId}/set-current`, {
        method: "POST",
      })

      const data = await res.json()

      if (res.ok) {
        fetchAcademicYears()
        toast({
          title: "Current year updated",
          description: `${data.year} is now the current academic year.`,
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to set current academic year",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to set current year:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setSettingCurrent(null)
    }
  }

  const handleDeleteYear = async () => {
    if (!deletingYear) return

    try {
      const res = await fetch(`/api/academic-years/${deletingYear.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (res.ok) {
        fetchAcademicYears()
        toast({
          title: "Academic year deleted",
          description: "Academic year has been deleted successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete academic year",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete academic year:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setDeletingYear(null)
    }
  }

  const handleDeleteTerm = async () => {
    if (!deletingTerm) return

    try {
      const res = await fetch(`/api/terms/${deletingTerm.term.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (res.ok) {
        fetchAcademicYears()
        toast({
          title: "Term deleted",
          description: "Term has been deleted successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete term",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete term:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setDeletingTerm(null)
    }
  }

  const toggleYearExpanded = (yearId: string) => {
    const newExpanded = new Set(expandedYears)
    if (newExpanded.has(yearId)) {
      newExpanded.delete(yearId)
    } else {
      newExpanded.add(yearId)
    }
    setExpandedYears(newExpanded)
  }

  const getStatusBadge = (year: AcademicYear) => {
    if (year.isCurrent) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Current</Badge>
    }
    if (year.isUpcoming) {
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Upcoming</Badge>
    }
    if (year.status === "COMPLETED") {
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Completed</Badge>
    }
    if (year.status === "ARCHIVED") {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Archived</Badge>
    }
    return <Badge variant="outline">Active</Badge>
  }

  const currentYear = academicYears.find(y => y.isCurrent)
  const upcomingYear = academicYears.find(y => y.isUpcoming)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Academic Years</h1>
          <p className="text-muted-foreground">Manage academic years and terms</p>
        </div>
        <Dialog open={isYearDialogOpen} onOpenChange={(open) => {
          setIsYearDialogOpen(open)
          if (!open) setEditingYear(null)
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Academic Year
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingYear ? "Edit Academic Year" : "Add New Academic Year"}
              </DialogTitle>
              <DialogDescription>
                {editingYear 
                  ? "Update the academic year details" 
                  : "Create a new academic year"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleYearSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Academic Year</Label>
                  <Input 
                    id="year" 
                    name="year" 
                    placeholder="e.g., 2025-2026" 
                    defaultValue={editingYear?.year}
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input 
                      id="startDate" 
                      name="startDate" 
                      type="date" 
                      defaultValue={editingYear ? new Date(editingYear.startDate).toISOString().split('T')[0] : undefined}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input 
                      id="endDate" 
                      name="endDate" 
                      type="date" 
                      defaultValue={editingYear ? new Date(editingYear.endDate).toISOString().split('T')[0] : undefined}
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={editingYear?.status || "ACTIVE"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isCurrent"
                      name="isCurrent"
                      defaultChecked={editingYear?.isCurrent}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isCurrent">Set as current year</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isUpcoming"
                      name="isUpcoming"
                      defaultChecked={editingYear?.isUpcoming}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isUpcoming">Set as upcoming year</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {editingYear ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Academic Year</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentYear?.year || "Not Set"}</div>
            {currentYear && (
              <p className="text-xs text-muted-foreground">
                {formatDate(currentYear.startDate)} - {formatDate(currentYear.endDate)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Year</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingYear?.year || "Not Set"}</div>
            {upcomingYear && (
              <p className="text-xs text-muted-foreground">
                {formatDate(upcomingYear.startDate)} - {formatDate(upcomingYear.endDate)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Academic Years</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{academicYears.length}</div>
            <p className="text-xs text-muted-foreground">
              {academicYears.filter(y => y.status === "ACTIVE").length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Academic Years List */}
      <Card>
        <CardHeader>
          <CardTitle>All Academic Years</CardTitle>
          <CardDescription>
            Click on a year to view and manage its terms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : academicYears.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No academic years found. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {academicYears.map((year) => (
                <Collapsible
                  key={year.id}
                  open={expandedYears.has(year.id)}
                  onOpenChange={() => toggleYearExpanded(year.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          {expandedYears.has(year.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{year.year}</span>
                              {getStatusBadge(year)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(year.startDate)} - {formatDate(year.endDate)} • {year.terms.length} terms
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {!year.isCurrent && year.status === "ACTIVE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetCurrent(year.id)}
                              disabled={settingCurrent === year.id}
                            >
                              {settingCurrent === year.id ? "Setting..." : "Set as Current"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingYear(year)
                              setIsYearDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingYear(year)}
                            disabled={year.isCurrent}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Terms</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedYearForTerm(year)
                              setEditingTerm(null)
                              setIsTermDialogOpen(true)
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Term
                          </Button>
                        </div>
                        {year.terms.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No terms configured for this academic year
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Term</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {year.terms.map((term) => (
                                <TableRow key={term.id}>
                                  <TableCell className="font-medium">
                                    {term.name}
                                  </TableCell>
                                  <TableCell>{formatDate(term.startDate)}</TableCell>
                                  <TableCell>{formatDate(term.endDate)}</TableCell>
                                  <TableCell>
                                    {term.isCurrent && (
                                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                        Current
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedYearForTerm(year)
                                          setEditingTerm(term)
                                          setIsTermDialogOpen(true)
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeletingTerm({ term, yearId: year.id })}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}

                        {/* Year Statistics */}
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">Statistics</h4>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Enrollments:</span>{" "}
                              <span className="font-medium">{year._count.enrollments}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Applications:</span>{" "}
                              <span className="font-medium">{year._count.applications}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Results:</span>{" "}
                              <span className="font-medium">{year._count.results}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fee Records:</span>{" "}
                              <span className="font-medium">{year._count.fees}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Term Dialog */}
      <Dialog open={isTermDialogOpen} onOpenChange={(open) => {
        setIsTermDialogOpen(open)
        if (!open) {
          setEditingTerm(null)
          setSelectedYearForTerm(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTerm ? "Edit Term" : "Add New Term"}
            </DialogTitle>
            <DialogDescription>
              {selectedYearForTerm && (
                <span>
                  {editingTerm 
                    ? `Update term for ${selectedYearForTerm.year}` 
                    : `Create a new term for ${selectedYearForTerm.year}`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTermSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="termName">Term Name</Label>
                  <Input 
                    id="termName" 
                    name="name" 
                    placeholder="e.g., First Term" 
                    defaultValue={editingTerm?.name}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termNumber">Term Number</Label>
                  <Select name="termNumber" defaultValue={editingTerm?.termNumber?.toString() || "1"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select term number" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="termStartDate">Start Date</Label>
                  <Input 
                    id="termStartDate" 
                    name="startDate" 
                    type="date" 
                    defaultValue={editingTerm ? new Date(editingTerm.startDate).toISOString().split('T')[0] : undefined}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termEndDate">End Date</Label>
                  <Input 
                    id="termEndDate" 
                    name="endDate" 
                    type="date" 
                    defaultValue={editingTerm ? new Date(editingTerm.endDate).toISOString().split('T')[0] : undefined}
                    required 
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="termIsCurrent"
                  name="isCurrent"
                  defaultChecked={editingTerm?.isCurrent}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="termIsCurrent">Set as current term</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">
                {editingTerm ? "Update Term" : "Create Term"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Year Confirmation */}
      <AlertDialog open={!!deletingYear} onOpenChange={(open) => !open && setDeletingYear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Academic Year?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the academic year "{deletingYear?.year}" and all its terms.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteYear} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Term Confirmation */}
      <AlertDialog open={!!deletingTerm} onOpenChange={(open) => !open && setDeletingTerm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Term?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the term "{deletingTerm?.term.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTerm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
