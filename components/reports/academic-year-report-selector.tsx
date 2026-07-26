"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AcademicYear = {
  id: string
  year: string
  isCurrent: boolean
}

export function AcademicYearReportSelector() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const selectedAcademicYearId = searchParams.get("academicYearId") || "current"

  useEffect(() => {
    async function fetchAcademicYears() {
      const response = await fetch("/api/academic-years?noPagination=true")
      if (response.ok) {
        const data = await response.json()
        setAcademicYears(Array.isArray(data) ? data : data?.data || [])
      }
    }

    fetchAcademicYears()
  }, [])

  const handleChange = (academicYearId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (academicYearId === "current") {
      params.delete("academicYearId")
      params.delete("termId")
    } else {
      params.set("academicYearId", academicYearId)
      params.delete("termId")
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className="w-full sm:w-64">
      <Select value={selectedAcademicYearId} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Academic year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current">Current academic year</SelectItem>
          {academicYears.map((year) => (
            <SelectItem key={year.id} value={year.id}>
              {year.year}{year.isCurrent ? " (Current)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
