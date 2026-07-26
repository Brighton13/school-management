import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()
const password = "password123"

const permissions = [
  "students.create", "students.read", "students.update", "students.delete", "students.bulk_upload",
  "staff.create", "staff.read", "staff.update", "staff.delete",
  "classes.create", "classes.read", "classes.update", "classes.delete",
  "sections.create", "sections.read", "sections.update", "sections.delete",
  "subjects.create", "subjects.read", "subjects.update", "subjects.delete",
  "terms.create", "terms.read", "terms.update", "terms.delete",
  "academic_years.create", "academic_years.read", "academic_years.update", "academic_years.delete",
  "results.create", "results.read", "results.update", "results.delete", "results.approve", "results.review", "results.class_teacher_submit", "results.principal_approve",
  "reports.generate", "reports.view", "reports.download", "reports.bulk_generate", "reports.comments.create", "reports.comments.read", "reports.comments.update", "reports.comments.delete",
  "fees.create", "fees.read", "fees.update", "fees.delete",
  "exams.create", "exams.read", "exams.update", "exams.delete",
  "enrollment.create", "enrollment.read", "enrollment.update", "enrollment.delete", "enrollment.bulk_upload",
  "inventory.create", "inventory.read", "inventory.update", "inventory.delete",
  "announcements.create", "announcements.read", "announcements.update", "announcements.delete",
  "roles.create", "roles.read", "roles.update", "roles.delete",
  "permissions.create", "permissions.read", "permissions.update", "permissions.delete",
  "users.create", "users.read", "users.update", "users.delete",
  "settings.read", "settings.update",
  "audit.read", "session_logs.read",
  "teacher_assignments.create", "teacher_assignments.read", "teacher_assignments.update", "teacher_assignments.delete",
  "promotions.create", "promotions.read", "promotions.update", "promotions.delete",
  "applications.create", "applications.read", "applications.update", "applications.delete", "applications.approve",
  "attendance.create", "attendance.read", "attendance.update", "attendance.delete",
  "signatures.create", "signatures.read", "signatures.update", "signatures.delete",
  "dashboard.view", "dashboard.analytics",
  "parents.create", "parents.read", "parents.update", "parents.delete",
]

const rolePermissionMap: Record<string, (name: string) => boolean> = {
  ADMIN: () => true,
  PRINCIPAL: (name) => !name.startsWith("roles.") && !name.startsWith("permissions."),
  TEACHER: (name) =>
    name.startsWith("results.") ||
    name.startsWith("reports.") ||
    name.startsWith("attendance.") ||
    ["students.read", "classes.read", "sections.read", "subjects.read", "terms.read", "academic_years.read", "exams.read", "announcements.read", "dashboard.view"].includes(name),
  ACCOUNTANT: (name) =>
    name.startsWith("fees.") ||
    ["students.read", "reports.view", "reports.generate", "dashboard.view"].includes(name),
  LIBRARIAN: (name) => name.startsWith("inventory.") || ["announcements.read", "dashboard.view"].includes(name),
  STUDENT: (name) => ["results.read", "fees.read", "reports.view", "announcements.read", "dashboard.view", "attendance.read"].includes(name),
  PARENT: (name) => ["results.read", "fees.read", "reports.view", "announcements.read", "dashboard.view", "attendance.read"].includes(name),
}

const termDates: Record<number, Array<[string, string]>> = {
  2024: [["2024-01-15", "2024-04-12"], ["2024-05-06", "2024-08-09"], ["2024-09-02", "2024-12-06"]],
  2025: [["2025-01-13", "2025-04-11"], ["2025-05-05", "2025-08-08"], ["2025-09-01", "2025-12-05"]],
  2026: [["2026-01-12", "2026-04-10"], ["2026-05-04", "2026-08-14"], ["2026-09-07", "2026-12-11"]],
}

function pct(base: number, offset: number) {
  return Math.max(28, Math.min(98, base + offset))
}

async function ensureRoleData() {
  const createdPermissions = []
  for (const name of permissions) {
    const [module, ...actionParts] = name.split(".")
    createdPermissions.push(
      await prisma.permission.upsert({
        where: { name },
        update: { module, action: actionParts.join(".") },
        create: { name, module, action: actionParts.join("."), description: `Demo permission for ${name}` },
      })
    )
  }

  const roles: Record<string, string> = {}
  for (const roleName of Object.keys(rolePermissionMap)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { isSystem: true },
      create: { name: roleName, description: `${roleName} demo role`, isSystem: true },
    })
    roles[roleName] = role.id
  }

  for (const [roleName, predicate] of Object.entries(rolePermissionMap)) {
    for (const permission of createdPermissions.filter((item) => predicate(item.name))) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles[roleName], permissionId: permission.id } },
        update: { granted: true },
        create: { roleId: roles[roleName], permissionId: permission.id, granted: true },
      })
    }
  }

  return roles
}

async function ensureUser(email: string, name: string, role: string, roleId: string) {
  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, isActive: true },
    create: { email, password: hashedPassword, name, role, isActive: true },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId } },
    update: {},
    create: { userId: user.id, roleId },
  })

  return user
}

async function ensureStaff(email: string, name: string, role: string, roleId: string, employeeId: string, designation: string, departmentId: string, salary: number, experience: number) {
  const user = await ensureUser(email, name, role, roleId)
  const staff = await prisma.staff.upsert({
    where: { userId: user.id },
    update: { employeeId, designation, departmentId, salary, experience, status: "ACTIVE" },
    create: {
      userId: user.id,
      employeeId,
      designation,
      departmentId,
      salary,
      experience,
      qualification: designation === "TEACHER" ? "Bachelor of Education" : "Diploma",
      joiningDate: new Date("2022-01-10"),
      gender: employeeId.endsWith("2") || employeeId.endsWith("4") ? "FEMALE" : "MALE",
      status: "ACTIVE",
    },
  })
  return { user, staff }
}

async function ensureFee(studentId: string, termId: string, academicYearId: string, feeType: string, amount: number, dueDate: Date, createdBy: string, index: number) {
  const existing = await prisma.fee.findFirst({ where: { studentId, termId, feeType } })
  const paidAmount = index % 7 === 0 ? 0 : index % 5 === 0 ? amount * 0.5 : amount
  const status = paidAmount === 0 ? "OVERDUE" : paidAmount < amount ? "PARTIAL" : "PAID"
  const fee = existing
    ? await prisma.fee.update({ where: { id: existing.id }, data: { amount, paidAmount, status, dueDate } })
    : await prisma.fee.create({
        data: { studentId, termId, academicYearId, feeType, amount, paidAmount, status, dueDate, paidDate: paidAmount > 0 ? new Date(dueDate.getTime() - 86400000 * 4) : null, createdBy },
      })

  if (paidAmount > 0) {
    const receiptNumber = `DEMO-${fee.id.slice(-8)}-${feeType}`
    const payment = await prisma.payment.findFirst({ where: { receiptNumber } })
    if (!payment) {
      const createdPayment = await prisma.payment.create({
        data: {
          feeId: fee.id,
          studentId,
          amount: paidAmount,
          paymentMethod: index % 4 === 0 ? "MOBILE_MONEY" : "CASH",
          receiptNumber,
          status: "SUCCESS",
          receivedBy: createdBy,
          createdAt: new Date(dueDate.getTime() - 86400000 * (index % 12)),
        },
      })
      if (index % 4 === 0) {
        await prisma.mobileMoneyTransaction.upsert({
          where: { reference: `MM-${receiptNumber}` },
          update: { status: "successful" },
          create: {
            paymentId: createdPayment.id,
            reference: `MM-${receiptNumber}`,
            phone: `26097${String(1000000 + index).slice(0, 7)}`,
            operator: index % 2 === 0 ? "airtel" : "mtn",
            country: "zm",
            amount: paidAmount,
            status: "successful",
            completedAt: createdPayment.createdAt,
          },
        })
      }
    }
  }

  return fee
}

async function main() {
  console.log("Seeding full demo data...")
  const roles = await ensureRoleData()

  await prisma.schoolConfig.upsert({
    where: { id: "demo-school-config" },
    update: { schoolName: "Demo Valley School", schoolEmail: "info@demovalley.school" },
    create: {
      id: "demo-school-config",
      schoolName: "Demo Valley School",
      schoolMotto: "Learning for life",
      schoolAddress: "Lusaka, Zambia",
      schoolPhone: "+260 211 000000",
      schoolEmail: "info@demovalley.school",
      ministryHeader: "MINISTRY OF EDUCATION",
      principalName: "Grace Principal",
      reportFooterText: "Generated from demo school data",
      nextTermDate: new Date("2026-09-07"),
    },
  })

  await prisma.emailConfig.upsert({
    where: { id: "demo-email-config" },
    update: { isActive: true },
    create: { id: "demo-email-config", host: "smtp.demo.local", port: 587, secure: false, user: "mailer", password: "demo", from: "noreply@demovalley.school", isActive: true },
  })

  await prisma.systemSettings.upsert({
    where: { id: "demo-system-settings" },
    update: { idleTimeoutMinutes: 45, warningBeforeLogoutMinutes: 5, isIdleTimeoutEnabled: true },
    create: { id: "demo-system-settings", idleTimeoutMinutes: 45, warningBeforeLogoutMinutes: 5, isIdleTimeoutEnabled: true },
  })

  await prisma.academicYear.updateMany({ data: { isCurrent: false, isUpcoming: false } })
  const years = []
  for (const year of [2024, 2025, 2026]) {
    const academicYear = await prisma.academicYear.upsert({
      where: { year: `${year}` },
      update: { isCurrent: year === 2026, isUpcoming: false, status: year === 2026 ? "ACTIVE" : "COMPLETED" },
      create: {
        year: `${year}`,
        startDate: new Date(`${year}-01-01`),
        endDate: new Date(`${year}-12-31`),
        isCurrent: year === 2026,
        isUpcoming: false,
        status: year === 2026 ? "ACTIVE" : "COMPLETED",
      },
    })
    years.push(academicYear)
    for (let index = 0; index < termDates[year].length; index++) {
      const dates = termDates[year][index]
      await prisma.term.upsert({
        where: { academicYearId_termNumber: { academicYearId: academicYear.id, termNumber: index + 1 } },
        update: { isCurrent: year === 2026 && index === 1 },
        create: {
          academicYearId: academicYear.id,
          termNumber: index + 1,
          name: ["First Term", "Second Term", "Third Term"][index],
          startDate: new Date(dates[0]),
          endDate: new Date(dates[1]),
          isCurrent: year === 2026 && index === 1,
        },
      })
    }
  }

  const departments = []
  for (const department of [
    ["Administration", "ADM"],
    ["Mathematics", "MTH"],
    ["Languages", "LAN"],
    ["Sciences", "SCI"],
    ["Finance", "FIN"],
    ["Library", "LIB"],
  ]) {
    departments.push(await prisma.department.upsert({
      where: { code: department[1] },
      update: { name: department[0], isActive: true },
      create: { name: department[0], code: department[1], isActive: true, description: `${department[0]} department` },
    }))
  }

  const admin = await ensureStaff("admin@demo.school", "Alice Admin", "ADMIN", roles.ADMIN, "D-EMP-001", "ADMIN", departments[0].id, 18000, 10)
  const principal = await ensureStaff("principal@demo.school", "Grace Principal", "PRINCIPAL", roles.PRINCIPAL, "D-EMP-002", "PRINCIPAL", departments[0].id, 22000, 15)
  const accountant = await ensureStaff("accountant@demo.school", "Peter Accountant", "ACCOUNTANT", roles.ACCOUNTANT, "D-EMP-003", "ACCOUNTANT", departments[4].id, 12000, 7)
  await ensureStaff("librarian@demo.school", "Linda Librarian", "LIBRARIAN", roles.LIBRARIAN, "D-EMP-004", "LIBRARIAN", departments[5].id, 9000, 5)

  const directPermission = await prisma.permission.findUnique({ where: { name: "reports.download" } })
  if (directPermission) {
    await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: accountant.user.id, permissionId: directPermission.id } },
      update: { granted: true },
      create: { userId: accountant.user.id, permissionId: directPermission.id, granted: true },
    })
  }

  const teacherNames = ["Mary Maths", "John English", "Sarah Science", "Brian Social", "Faith ICT", "Moses Business"]
  const teachers = []
  for (let i = 0; i < teacherNames.length; i++) {
    const dept = departments[1 + (i % 3)]
    teachers.push(await ensureStaff(`teacher${i + 1}@demo.school`, teacherNames[i], "TEACHER", roles.TEACHER, `D-EMP-10${i + 1}`, "TEACHER", dept.id, 9500 + i * 700, 3 + i))
  }

  for (const person of [admin, principal, accountant, ...teachers]) {
    await prisma.signature.upsert({
      where: { userId: person.user.id },
      update: { signatureType: person.staff.designation },
      create: { userId: person.user.id, signatureType: person.staff.designation, signatureImage: "data:image/png;base64,demo-signature" },
    })
  }

  const classes = []
  for (let level = 1; level <= 6; level++) {
    classes.push(await prisma.class.upsert({
      where: { id: `demo-grade-${level}` },
      update: { name: `Grade ${level}`, level, capacity: 60 },
      create: { id: `demo-grade-${level}`, name: `Grade ${level}`, level, capacity: 60 },
    }))
  }

  const sections = []
  for (const cls of classes) {
    for (const sectionName of ["A", "B"]) {
      const section = await prisma.section.upsert({
        where: { id: `demo-section-${cls.level}-${sectionName}` },
        update: { classTeacherId: teachers[(cls.level + (sectionName === "B" ? 1 : 0)) % teachers.length].staff.id, capacity: 30 },
        create: {
          id: `demo-section-${cls.level}-${sectionName}`,
          name: sectionName,
          classId: cls.id,
          capacity: 30,
          classTeacherId: teachers[(cls.level + (sectionName === "B" ? 1 : 0)) % teachers.length].staff.id,
        },
      })
      sections.push(section)
    }
  }

  const subjectDefs: Array<[string, string, string]> = [
    ["Mathematics", "DEMO-MATH", "CORE"],
    ["English", "DEMO-ENG", "CORE"],
    ["Integrated Science", "DEMO-SCI", "CORE"],
    ["Social Studies", "DEMO-SOC", "CORE"],
    ["Computer Studies", "DEMO-ICT", "ELECTIVE"],
    ["Business Studies", "DEMO-BUS", "OPTIONAL"],
  ]
  const subjects: Awaited<ReturnType<typeof prisma.subject.upsert>>[] = []
  for (const [name, code, type] of subjectDefs) {
    subjects.push(await prisma.subject.upsert({
      where: { code },
      update: { name, type },
      create: { name, code, type, departmentId: departments[subjects.length % departments.length].id },
    }))
  }

  for (let i = 0; i < teachers.length; i++) {
    await prisma.staffSubject.upsert({
      where: { staffId_subjectId: { staffId: teachers[i].staff.id, subjectId: subjects[i % subjects.length].id } },
      update: {},
      create: { staffId: teachers[i].staff.id, subjectId: subjects[i % subjects.length].id },
    })
  }

  const classSubjects = []
  for (const cls of classes) {
    for (const section of sections.filter((item) => item.classId === cls.id)) {
      for (let i = 0; i < subjects.length; i++) {
        classSubjects.push(await prisma.classSubject.upsert({
          where: { classId_sectionId_subjectId: { classId: cls.id, sectionId: section.id, subjectId: subjects[i].id } },
          update: { teacherId: teachers[i % teachers.length].staff.id, maxMarks: 100, passMarks: 40 },
          create: { classId: cls.id, sectionId: section.id, subjectId: subjects[i].id, teacherId: teachers[i % teachers.length].staff.id, maxMarks: 100, passMarks: 40 },
        }))
      }
    }
  }

  const students = []
  let studentIndex = 0
  for (const section of sections) {
    const cls = classes.find((item) => item.id === section.classId)!
    for (let i = 1; i <= 6; i++) {
      studentIndex++
      const gender = studentIndex % 2 === 0 ? "FEMALE" : "MALE"
      const user = await ensureUser(`student${studentIndex}@demo.school`, `Demo Student ${studentIndex}`, "STUDENT", roles.STUDENT)
      const student = await prisma.student.upsert({
        where: { admissionNumber: `D-STU-${String(studentIndex).padStart(3, "0")}` },
        update: { status: "ACTIVE", gender },
        create: {
          admissionNumber: `D-STU-${String(studentIndex).padStart(3, "0")}`,
          userId: user.id,
          dateOfBirth: new Date(2012 + (studentIndex % 7), studentIndex % 12, 10),
          gender,
          address: `Demo Area ${studentIndex}`,
          emergencyContact: `26097${String(2000000 + studentIndex).slice(0, 7)}`,
          status: "ACTIVE",
        },
      })
      students.push({ student, section, cls, index: studentIndex })

      for (const academicYear of years) {
        await prisma.classEnrollment.upsert({
          where: { studentId_classId_sectionId_academicYearId: { studentId: student.id, classId: cls.id, sectionId: section.id, academicYearId: academicYear.id } },
          update: { status: academicYear.year === "2024" && studentIndex % 19 === 0 ? "WITHDRAWN" : "ACTIVE" },
          create: { studentId: student.id, classId: cls.id, sectionId: section.id, academicYearId: academicYear.id, status: academicYear.year === "2024" && studentIndex % 19 === 0 ? "WITHDRAWN" : "ACTIVE", enrolledAt: academicYear.startDate },
        })
      }
    }
  }

  for (let i = 1; i <= 18; i++) {
    const user = await ensureUser(`parent${i}@demo.school`, `Demo Parent ${i}`, "PARENT", roles.PARENT)
    const parent = await prisma.parent.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, occupation: i % 2 === 0 ? "Farmer" : "Business Owner", income: 3500 + i * 250 },
    })
    for (const child of students.slice((i - 1) * 2, (i - 1) * 2 + 2)) {
      if (!child) continue
      await prisma.studentParent.upsert({
        where: { studentId_parentId: { studentId: child.student.id, parentId: parent.id } },
        update: { isPrimary: true },
        create: { studentId: child.student.id, parentId: parent.id, relation: i % 2 === 0 ? "FATHER" : "MOTHER", isPrimary: true },
      })
    }
  }

  const currentYear = years.find((item) => item.year === "2026")!
  const terms = await prisma.term.findMany({ where: { academicYearId: { in: years.map((item) => item.id) } }, orderBy: [{ academicYear: { year: "asc" } }, { termNumber: "asc" }] })
  const exams = []
  for (const term of terms) {
    for (const examType of ["MID_TERM", "FINAL"]) {
      exams.push(await prisma.exam.upsert({
        where: { id: `demo-exam-${term.id}-${examType}` },
        update: { status: "COMPLETED" },
        create: {
          id: `demo-exam-${term.id}-${examType}`,
          name: `${term.name} ${examType.replace("_", " ")}`,
          examType,
          termId: term.id,
          academicYearId: term.academicYearId,
          startDate: new Date(term.startDate.getTime() + 86400000 * 25),
          endDate: new Date(term.startDate.getTime() + 86400000 * 30),
          isFinal: examType === "FINAL",
          status: "COMPLETED",
          createdBy: admin.user.id,
        },
      }))
    }
  }

  for (const item of students) {
    const relevantClassSubjects = classSubjects.filter((cs) => cs.classId === item.cls.id && cs.sectionId === item.section.id)
    for (const term of terms) {
      const termExams = exams.filter((exam) => exam.termId === term.id)
      for (const exam of termExams) {
        for (const cs of relevantClassSubjects.slice(0, 4)) {
          const existing = await prisma.result.findFirst({ where: { studentId: item.student.id, classSubjectId: cs.id, termId: term.id, examId: exam.id } })
          if (existing) continue
          const base = 48 + item.cls.level * 4 + (item.index % 9) * 3
          const score = pct(base, exam.examType === "FINAL" ? 4 : -2)
          await prisma.result.create({
            data: {
              studentId: item.student.id,
              classSubjectId: cs.id,
              termId: term.id,
              academicYearId: term.academicYearId,
              examId: exam.id,
              marksObtained: score,
              maxMarks: 100,
              grade: score >= 75 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D",
              points: score >= 75 ? 1 : score >= 65 ? 2 : score >= 50 ? 3 : 4,
              remarks: score < 50 ? "Needs intervention" : "Good progress",
              status: item.index % 13 === 0 ? "PENDING_APPROVAL" : "APPROVED",
              submittedBy: teachers[item.index % teachers.length].user.id,
              submittedAt: new Date(term.startDate.getTime() + 86400000 * 31),
              approvedBy: principal.user.id,
              approvedAt: new Date(term.startDate.getTime() + 86400000 * 34),
              published: true,
              publishedAt: new Date(term.startDate.getTime() + 86400000 * 35),
            },
          })
        }
      }
    }
  }

  const currentTerms = await prisma.term.findMany({ where: { academicYearId: currentYear.id }, orderBy: { termNumber: "asc" } })
  for (const item of students) {
    for (const term of currentTerms) {
      await ensureFee(item.student.id, term.id, currentYear.id, "TUITION", 2500 + item.cls.level * 100, new Date(term.startDate.getTime() + 86400000 * 21), accountant.user.id, item.index)
      await ensureFee(item.student.id, term.id, currentYear.id, "LIBRARY", 250, new Date(term.startDate.getTime() + 86400000 * 28), accountant.user.id, item.index + 1)
      if (item.index % 3 === 0) {
        await ensureFee(item.student.id, term.id, currentYear.id, "TRANSPORT", 750, new Date(term.startDate.getTime() + 86400000 * 35), accountant.user.id, item.index + 2)
      }
    }
  }

  const currentTerm = currentTerms.find((term) => term.isCurrent) || currentTerms[1]
  const attendanceStart = new Date("2026-05-04")
  for (let day = 0; day < 35; day++) {
    const date = new Date(attendanceStart.getTime() + day * 86400000)
    if ([0, 6].includes(date.getDay())) continue
    for (const item of students) {
      const marker = (item.index + day) % 17
      const status = marker === 0 ? "ABSENT" : marker === 1 ? "LATE" : marker === 2 ? "EXCUSED" : "PRESENT"
      await prisma.attendance.upsert({
        where: { studentId_sectionId_date: { studentId: item.student.id, sectionId: item.section.id, date } },
        update: { status, remarks: status === "ABSENT" ? "Illness reported" : status === "EXCUSED" ? "Family appointment" : null },
        create: { studentId: item.student.id, sectionId: item.section.id, academicYearId: currentYear.id, termId: currentTerm.id, date, status, remarks: status === "ABSENT" ? "Illness reported" : status === "EXCUSED" ? "Family appointment" : null },
      })
    }
    for (const teacher of teachers) {
      await prisma.attendance.create({
        data: { staffId: teacher.staff.id, academicYearId: currentYear.id, termId: currentTerm.id, date, status: (day + teacher.staff.employeeId.length) % 11 === 0 ? "LATE" : "PRESENT" },
      }).catch(() => undefined)
    }
  }

  for (const item of students.slice(0, 20)) {
    const application = await prisma.application.findFirst({ where: { studentId: item.student.id, appliedClassId: item.cls.id, academicYearId: currentYear.id } })
    if (!application) {
      await prisma.application.create({
        data: {
          studentId: item.student.id,
          appliedClassId: item.cls.id,
          appliedSectionId: item.section.id,
          academicYearId: currentYear.id,
          applicationStatus: item.index % 5 === 0 ? "PENDING" : item.index % 7 === 0 ? "REJECTED" : "APPROVED",
          notes: "Demo enrollment workflow record",
          rejectionReason: item.index % 7 === 0 ? "Incomplete documents" : null,
          createdBy: admin.user.id,
          approvedBy: item.index % 5 === 0 ? null : principal.user.id,
          approvedAt: item.index % 5 === 0 ? null : new Date("2026-01-20"),
        },
      })
    }
  }

  for (const item of students.slice(0, 24)) {
    const cs = classSubjects.find((subject) => subject.classId === item.cls.id && subject.sectionId === item.section.id && subject.subjectId === subjects[4].id)
    if (!cs) continue
    await prisma.studentSubjectSelection.upsert({
      where: { studentId_classSubjectId_academicYearId: { studentId: item.student.id, classSubjectId: cs.id, academicYearId: currentYear.id } },
      update: { status: "ACTIVE" },
      create: { studentId: item.student.id, classSubjectId: cs.id, academicYearId: currentYear.id, status: "ACTIVE" },
    })
  }

  for (const section of sections.slice(0, 6)) {
    const sectionSubjects = classSubjects.filter((cs) => cs.sectionId === section.id).slice(0, 4)
    for (let i = 0; i < sectionSubjects.length; i++) {
      await prisma.timetable.upsert({
        where: { classId_sectionId_day_startTime: { classId: sectionSubjects[i].classId, sectionId: section.id, day: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"][i], startTime: "08:00" } },
        update: { endTime: "09:00", room: `Room ${section.name}${i + 1}` },
        create: { classId: sectionSubjects[i].classId, sectionId: section.id, classSubjectId: sectionSubjects[i].id, day: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"][i], startTime: "08:00", endTime: "09:00", room: `Room ${section.name}${i + 1}` },
      })
    }
  }

  for (const cs of classSubjects.slice(0, 8)) {
    const assignment = await prisma.assignment.findFirst({ where: { title: `Demo Assignment ${cs.id.slice(-4)}` } }) ||
      await prisma.assignment.create({ data: { title: `Demo Assignment ${cs.id.slice(-4)}`, description: "Demo continuous assessment task", classSubjectId: cs.id, teacherId: cs.teacherId!, dueDate: new Date("2026-06-15"), maxMarks: 20 } })
    for (const item of students.filter((student) => student.cls.id === cs.classId && student.section.id === cs.sectionId).slice(0, 4)) {
      await prisma.studentAssignment.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: item.student.id } },
        update: { status: "GRADED", marks: 12 + (item.index % 8) },
        create: { assignmentId: assignment.id, studentId: item.student.id, status: "GRADED", submittedAt: new Date("2026-06-12"), marks: 12 + (item.index % 8), feedback: "Demo feedback" },
      })
    }
  }

  for (const item of ["Projector", "Science Lab Kit", "Library Books", "First Aid Supplies"]) {
    const inventory = await prisma.inventoryItem.findFirst({ where: { name: `Demo ${item}` } }) ||
      await prisma.inventoryItem.create({ data: { name: `Demo ${item}`, category: item.includes("Books") ? "BOOKS" : "EQUIPMENT", quantity: 20, unit: "pieces", minStock: 5, location: "Main Store", cost: 1500 } })
    await prisma.inventoryTransaction.create({ data: { itemId: inventory.id, type: "IN", quantity: 5, reason: "Demo stock update", userId: admin.user.id } }).catch(() => undefined)
  }

  for (const title of ["Demo PTA Meeting", "Demo Sports Day", "Demo Exam Timetable Published"]) {
    const existing = await prisma.announcement.findFirst({ where: { title } })
    const announcement = existing ||
      await prisma.announcement.create({ data: { title, content: `${title} details for testing.`, type: "GENERAL", targetAudience: "ALL", published: true, publishedAt: new Date(), createdBy: admin.user.id, expiresAt: new Date("2026-12-31") } })
    const attachment = await prisma.announcementAttachment.findFirst({ where: { announcementId: announcement.id, fileName: "demo-notice.pdf" } })
    if (!attachment) {
      await prisma.announcementAttachment.create({
        data: {
          announcementId: announcement.id,
          fileName: "demo-notice.pdf",
          originalName: `${title}.pdf`,
          fileSize: 128000,
          mimeType: "application/pdf",
          filePath: "/uploads/demo-notice.pdf",
        },
      })
    }
  }

  await prisma.remarkTemplate.createMany({
    data: [
      { minPercentage: 80, maxPercentage: 100, remark: "Excellent", category: "SUBJECT" },
      { minPercentage: 60, maxPercentage: 79.99, remark: "Good", category: "SUBJECT" },
      { minPercentage: 40, maxPercentage: 59.99, remark: "Satisfactory", category: "SUBJECT" },
      { minPercentage: 0, maxPercentage: 39.99, remark: "Needs Improvement", category: "SUBJECT" },
    ],
    skipDuplicates: true,
  })
  await prisma.commentTemplate.createMany({
    data: [
      { minPercentage: 80, maxPercentage: 100, comment: "Outstanding progress.", commentType: "CLASS_TEACHER" },
      { minPercentage: 0, maxPercentage: 79.99, comment: "Continue working steadily.", commentType: "CLASS_TEACHER" },
      { minPercentage: 80, maxPercentage: 100, comment: "Excellent performance.", commentType: "PRINCIPAL" },
      { minPercentage: 0, maxPercentage: 79.99, comment: "More effort is encouraged.", commentType: "PRINCIPAL" },
    ],
    skipDuplicates: true,
  })
  await prisma.pointsConfig.createMany({
    data: [
      { minPercentage: 75, maxPercentage: 100, points: 1, description: "Distinction" },
      { minPercentage: 65, maxPercentage: 74.99, points: 2, description: "Merit" },
      { minPercentage: 50, maxPercentage: 64.99, points: 3, description: "Credit" },
      { minPercentage: 0, maxPercentage: 49.99, points: 4, description: "Needs support" },
    ],
    skipDuplicates: true,
  })

  const reportTerm = currentTerm
  const reportExam = exams.find((exam) => exam.termId === reportTerm.id && exam.examType === "FINAL")!
  for (const item of students.slice(0, 10)) {
    const total = 320 + item.index * 3
    const report = await prisma.studentReport.upsert({
      where: { studentId_termId_examId: { studentId: item.student.id, termId: reportTerm.id, examId: reportExam.id } },
      update: { status: "APPROVED" },
      create: {
        studentId: item.student.id,
        sectionId: item.section.id,
        termId: reportTerm.id,
        academicYearId: currentYear.id,
        examId: reportExam.id,
        totalMarksObtained: total,
        maxTotalMarks: 400,
        positionInClass: item.index,
        classSize: 30,
        progressRatio: item.index % 2 === 0 ? 4 : -2,
        previousTermAverage: 70,
        currentTermAverage: total / 4,
        status: "APPROVED",
        submittedBy: teachers[item.index % teachers.length].user.id,
        submittedAt: new Date(),
        approvedBy: principal.user.id,
        approvedAt: new Date(),
        generatedBy: admin.user.id,
      },
    })
    const teacher = teachers[item.index % teachers.length].staff
    const existingComment = await prisma.reportComment.findFirst({ where: { reportId: report.id, teacherId: teacher.id, performanceArea: "OVERALL" } })
    if (!existingComment) {
      await prisma.reportComment.create({ data: { reportId: report.id, teacherId: teacher.id, commentText: "Demo report comment.", performanceArea: "OVERALL", signedAt: new Date() } })
    }
  }

  for (const section of sections.slice(0, 4)) {
    const teacherId = section.classTeacherId || teachers[0].staff.id
    for (const [lower, upper, text] of [[0, 49, "Needs close support"], [50, 74, "Making progress"], [75, 100, "Excellent work"]] as const) {
      await prisma.reportCommentConfig.upsert({
        where: { teacherId_sectionId_marksLowerBound_marksUpperBound_performanceArea: { teacherId, sectionId: section.id, marksLowerBound: lower, marksUpperBound: upper, performanceArea: "OVERALL" } },
        update: { commentTemplate: text, isActive: true },
        create: { teacherId, sectionId: section.id, marksLowerBound: lower, marksUpperBound: upper, commentTemplate: text, performanceArea: "OVERALL", isActive: true },
      })
    }
  }

  for (const section of sections.slice(0, 4)) {
    const submission = await prisma.examResultSubmission.upsert({
      where: { examId_sectionId: { examId: reportExam.id, sectionId: section.id } },
      update: { status: "APPROVED", submittedSubjects: 4, totalSubjects: 4 },
      create: { examId: reportExam.id, sectionId: section.id, academicYearId: currentYear.id, termId: reportTerm.id, totalSubjects: 4, submittedSubjects: 4, status: "APPROVED", totalStudents: 12, averageMarks: 68, highestMarks: 94, lowestMarks: 35, passRate: 82 },
    })
    for (const cs of classSubjects.filter((item) => item.sectionId === section.id).slice(0, 4)) {
      await prisma.examSubjectSubmission.upsert({
        where: { examResultSubmissionId_classSubjectId: { examResultSubmissionId: submission.id, classSubjectId: cs.id } },
        update: { isComplete: true, resultsEntered: 12 },
        create: { examResultSubmissionId: submission.id, classSubjectId: cs.id, totalStudents: 12, resultsEntered: 12, isComplete: true, submittedBy: cs.teacherId ? teachers.find((teacher) => teacher.staff.id === cs.teacherId)?.user.id : undefined, submittedAt: new Date() },
      })
    }
  }

  await prisma.schoolLicense.upsert({
    where: { licenseId: "demo-license-001" },
    update: { status: "ACTIVE", maxStudents: 500 },
    create: {
      licenseId: "demo-license-001",
      customerId: "demo-customer",
      customerName: "Demo Valley School",
      schoolName: "Demo Valley School",
      planName: "Demo Premium",
      keyHash: "demo-license-key-hash",
      status: "ACTIVE",
      startsAt: new Date("2026-01-01"),
      expiresAt: new Date("2027-01-01"),
      maxStudents: 500,
      billingModel: "PER_STUDENT",
      perStudentRate: 2,
      currency: "USD",
      features: { reports: true, payments: true },
      rawPayload: { demo: true },
    },
  })
  const license = await prisma.schoolLicense.findUnique({ where: { licenseId: "demo-license-001" } })
  if (license) {
    await prisma.licenseEvent.create({ data: { licenseId: license.id, type: "VERIFIED", message: "Demo license verified" } }).catch(() => undefined)
    await prisma.licenseBillingSnapshot.create({ data: { licenseId: license.id, activeStudentCount: students.length, maxStudents: 500, billingModel: "PER_STUDENT", perStudentRate: 2, currency: "USD", estimatedAmount: students.length * 2 } }).catch(() => undefined)
  }

  for (const user of [admin.user, principal.user, accountant.user, ...students.slice(0, 5).map((item) => ({ id: item.student.userId, role: "STUDENT" }))]) {
    await prisma.auditTrail.create({ data: { userId: user.id, action: "VIEW", entityType: "DemoData", description: "Demo audit trail record" } }).catch(() => undefined)
    await prisma.sessionLog.create({ data: { userId: user.id, ipAddress: "127.0.0.1", userAgent: "Demo Browser", deviceType: "DESKTOP", browser: "Chrome", os: "Windows", loginAt: new Date(), isActive: false, duration: 900 } }).catch(() => undefined)
    await prisma.notification.create({ data: { userId: user.id, title: "Demo Notification", message: "This is demo test data.", type: "INFO", category: "DEMO", read: false } }).catch(() => undefined)
  }

  await prisma.passwordResetToken.create({ data: { userId: students[0].student.userId, token: `demo-reset-${Date.now()}`, expiresAt: new Date(Date.now() + 3600000) } }).catch(() => undefined)

  console.log("Full demo data seeded.")
  console.log("Demo logins:")
  console.log(`  Admin: admin@demo.school / ${password}`)
  console.log(`  Principal: principal@demo.school / ${password}`)
  console.log(`  Accountant: accountant@demo.school / ${password}`)
  console.log(`  Teacher: teacher1@demo.school / ${password}`)
  console.log(`  Student: student1@demo.school / ${password}`)
  console.log(`  Parent: parent1@demo.school / ${password}`)
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
