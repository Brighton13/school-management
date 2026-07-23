"use client"

import { useEffect, useState } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, Trash2, Search } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { Pagination, usePagination, PaginationInfo, buildPaginatedQuery } from "@/components/ui/pagination"

interface AcademicYear {
  id: string
  year: string
  isCurrent: boolean
  isUpcoming: boolean
  status: string
}

interface Term {
  id: string
  name: string
  termNumber: number
  academicYear: {
    id: string
    year: string
  }
  startDate: string
  endDate: string
  isCurrent: boolean
}

export default function TermsPage() {
  const [terms, setTerms] = useState<Term[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [deletingTerm, setDeletingTerm] = useState<Term | null>(null)
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("")
  const { toast } = useToast()
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAcademicYearId, setFilterAcademicYearId] = useState("all")
  const { page, limit, setPage, setLimit, reset: resetPagination } = usePagination(25)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchTerms()
  }, [page, limit, filterAcademicYearId])

  useEffect(() => {
    const timer = setTimeout(() => {
      resetPagination()
      fetchTerms()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchTerms = async () => {
    try {
      setLoading(true)
      const queryString = buildPaginatedQuery(
        {
          search: searchTerm || undefined,
          academicYearId: filterAcademicYearId === "all" ? undefined : filterAcademicYearId,
        },
        { page, limit }
      )
      const termsRes = await fetch(`/api/terms?${queryString}`)
      if (termsRes.status === 401 || termsRes.status === 403) {
        setPermissionDenied(true)
        return
      }
      const termsData = await termsRes.json()
      setTerms(termsData.data || [])
      if (termsData.pagination) setPaginationInfo(termsData.pagination)
    } catch (error) {
      console.error("Failed to fetch terms:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const [termsRes, yearsRes] = await Promise.all([
        fetch(`/api/terms?${buildPaginatedQuery({}, { page, limit })}`),
        fetch("/api/academic-years?noPagination=true")
      ])
      
      if (termsRes.status === 401 || termsRes.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      
      const termsData = await termsRes.json()
      const yearsData = await yearsRes.json()
      
      const termsArr = termsData.data || []
      const yearsArr = Array.isArray(yearsData) ? yearsData : (yearsData.data || [])
      
      setTerms(termsArr)
      if (termsData.pagination) setPaginationInfo(termsData.pagination)
      setAcademicYears(yearsArr)
      
      // Set default academic year to current one
      const currentYear = yearsArr.find((y: AcademicYear) => y.isCurrent)
      if (currentYear) {
        setSelectedAcademicYearId(currentYear.id)
      } else if (yearsArr.length > 0) {
        setSelectedAcademicYearId(yearsArr[0].id)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const academicYearId = selectedAcademicYearId
    if (!academicYearId) {
      toast({
        title: "Error",
        description: "Please select an academic year",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingTerm ? `/api/terms/${editingTerm.id}` : "/api/terms"
      const method = editingTerm ? "PATCH" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          academicYearId: academicYearId,
          termNumber: parseInt(formData.get("termNumber") as string) || 1,
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
          isCurrent: formData.get("isCurrent") === "on",
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setEditingTerm(null)
        fetchData()
        toast({
          title: editingTerm ? "Term updated" : "Term created",
          description: editingTerm 
            ? "Academic term has been updated successfully." 
            : "Academic term has been created successfully.",
        })
      } else {
        const error = await res.json()
        toast({
          title: "Error",
          description: error.error || "Failed to save term",
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

  const handleEdit = (term: Term) => {
    setEditingTerm(term)
    setSelectedAcademicYearId(term.academicYear.id)
    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingTerm) return

    try {
      const res = await fetch(`/api/terms/${deletingTerm.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (res.ok) {
        fetchData()
        toast({
          title: "Term deleted",
          description: "Academic term has been deleted successfully.",
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

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingTerm(null)
      // Reset to current academic year when closing
      const currentYear = academicYears.find(y => y.isCurrent)
      if (currentYear) {
        setSelectedAcademicYearId(currentYear.id)
      }
    }
  }

  const handleAddNew = () => {
    setEditingTerm(null)
    // Reset to current academic year
    const currentYear = academicYears.find(y => y.isCurrent)
    if (currentYear) {
      setSelectedAcademicYearId(currentYear.id)
    }
    setIsDialogOpen(true)
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
          <h1 className="text-3xl font-bold">Academic Terms</h1>
          <p className="text-muted-foreground">Manage academic terms and sessions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Term
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTerm ? "Edit Academic Term" : "Add New Academic Term"}
              </DialogTitle>
              <DialogDescription>
                {editingTerm 
                  ? "Update the academic term details" 
                  : "Create a new academic term"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Term Name</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      placeholder="e.g., First Term" 
                      defaultValue={editingTerm?.name}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academicYear">Academic Year</Label>
                    <Select 
                      value={selectedAcademicYearId} 
                      onValueChange={setSelectedAcademicYearId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select academic year" />
                      </SelectTrigger>
                      <SelectContent>
                        {academicYears.map((year) => (
                          <SelectItem key={year.id} value={year.id}>
                            {year.year} {year.isCurrent && "(Current)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input 
                      id="startDate" 
                      name="startDate" 
                      type="date" 
                      defaultValue={editingTerm ? new Date(editingTerm.startDate).toISOString().split('T')[0] : undefined}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input 
                      id="endDate" 
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
                    id="isCurrent"
                    name="isCurrent"
                    defaultChecked={editingTerm?.isCurrent}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="isCurrent">Set as current term</Label>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Terms</CardTitle>
          <CardDescription>
            Search and filter terms without loading the full term list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select
              value={filterAcademicYearId}
              onValueChange={(value) => {
                setFilterAcademicYearId(value)
                resetPagination()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Academic year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All academic years</SelectItem>
                {academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : terms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No terms found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term Name</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium">{term.name}</TableCell>
                    <TableCell>{term.academicYear.year}</TableCell>
                    <TableCell>{formatDate(term.startDate)}</TableCell>
                    <TableCell>{formatDate(term.endDate)}</TableCell>
                    <TableCell>
                      {term.isCurrent && (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          Current
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(term)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingTerm(term)}
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
          {paginationInfo.total > 0 && (
            <Pagination pagination={paginationInfo} onPageChange={setPage} onLimitChange={setLimit} />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTerm} onOpenChange={(open) => !open && setDeletingTerm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the academic term "{deletingTerm?.name}" ({deletingTerm?.academicYear?.year}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

