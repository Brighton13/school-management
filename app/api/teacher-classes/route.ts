import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only teachers can access this endpoint
    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Only teachers can access this endpoint" }, { status: 403 })
    }

    // Get the staff record for this teacher
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        // Sections where teacher is class teacher
        sections: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            class: {
              name: "asc",
            },
          },
        },
        // Classes where teacher teaches subjects
        classSubjects: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            section: {
              select: {
                id: true,
                name: true,
              },
            },
            subject: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            class: {
              name: "asc",
            },
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff record not found" }, { status: 404 })
    }

    // Build a combined list of classes/sections the teacher has access to
    const classMap = new Map<string, {
      id: string
      name: string
      sections: Map<string, { id: string; name: string; isClassTeacher: boolean; subjects: string[] }>
    }>()

    // Add sections where teacher is class teacher
    for (const section of staff.sections) {
      const classId = section.class.id
      if (!classMap.has(classId)) {
        classMap.set(classId, {
          id: classId,
          name: section.class.name,
          sections: new Map(),
        })
      }
      const classEntry = classMap.get(classId)!
      if (!classEntry.sections.has(section.id)) {
        classEntry.sections.set(section.id, {
          id: section.id,
          name: section.name,
          isClassTeacher: true,
          subjects: [],
        })
      } else {
        classEntry.sections.get(section.id)!.isClassTeacher = true
      }
    }

    // Add class-subjects where teacher teaches
    for (const cs of staff.classSubjects) {
      const classId = cs.class.id
      if (!classMap.has(classId)) {
        classMap.set(classId, {
          id: classId,
          name: cs.class.name,
          sections: new Map(),
        })
      }
      const classEntry = classMap.get(classId)!
      
      // If subject is assigned to a specific section
      if (cs.section) {
        if (!classEntry.sections.has(cs.section.id)) {
          classEntry.sections.set(cs.section.id, {
            id: cs.section.id,
            name: cs.section.name,
            isClassTeacher: false,
            subjects: [cs.subject.name],
          })
        } else {
          const sectionEntry = classEntry.sections.get(cs.section.id)!
          if (!sectionEntry.subjects.includes(cs.subject.name)) {
            sectionEntry.subjects.push(cs.subject.name)
          }
        }
      } else {
        // Subject is assigned to whole class (all sections)
        // Mark as "All Sections" entry
        const allSectionsKey = `${classId}_all`
        if (!classEntry.sections.has(allSectionsKey)) {
          classEntry.sections.set(allSectionsKey, {
            id: "all",
            name: "All Sections",
            isClassTeacher: false,
            subjects: [cs.subject.name],
          })
        } else {
          const allEntry = classEntry.sections.get(allSectionsKey)!
          if (!allEntry.subjects.includes(cs.subject.name)) {
            allEntry.subjects.push(cs.subject.name)
          }
        }
      }
    }

    // Convert to array format
    const result = Array.from(classMap.values()).map(cls => ({
      id: cls.id,
      name: cls.name,
      sections: Array.from(cls.sections.values()).map(section => ({
        id: section.id,
        name: section.name,
        isClassTeacher: section.isClassTeacher,
        subjects: section.subjects,
      })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching teacher classes:", error)
    return NextResponse.json(
      { error: "Failed to fetch teacher classes" },
      { status: 500 }
    )
  }
}
