import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAcademicContext } from "@/lib/academic-year"

export async function resolveReportingAcademicScope(request: NextRequest) {
  const requestedAcademicYearId = request.nextUrl.searchParams.get("academicYearId")
  const requestedTermId = request.nextUrl.searchParams.get("termId")

  if (requestedAcademicYearId) {
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: requestedAcademicYearId },
      include: {
        terms: {
          orderBy: { termNumber: "asc" },
        },
      },
    })

    if (!academicYear) {
      throw new Error("Selected academic year was not found.")
    }

    const selectedTerm = requestedTermId
      ? academicYear.terms.find((term) => term.id === requestedTermId)
      : academicYear.terms.find((term) => term.isCurrent) ||
        academicYear.terms[academicYear.terms.length - 1] ||
        null

    return {
      academicYearId: academicYear.id,
      academicYear: academicYear.year,
      termId: selectedTerm?.id || null,
      termName: selectedTerm?.name || "All terms",
      termNumber: selectedTerm?.termNumber || null,
      isCurrentScope: academicYear.isCurrent && Boolean(selectedTerm?.isCurrent),
    }
  }

  const context = await getAcademicContext()

  return {
    academicYearId: context.academicYearId,
    academicYear: context.academicYear,
    termId: context.termId,
    termName: context.termName,
    termNumber: context.termNumber,
    isCurrentScope: true,
  }
}
