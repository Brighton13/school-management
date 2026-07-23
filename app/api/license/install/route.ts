import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  calculateLicenseAmount,
  hashLicenseKey,
  verifyLicenseKey,
} from "@/lib/license"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const licenseKey = String(body.licenseKey || "").trim()
    if (!licenseKey) {
      return NextResponse.json({ error: "License key is required" }, { status: 400 })
    }

    const verification = verifyLicenseKey(licenseKey)
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error }, { status: 400 })
    }

    const payload = verification.payload
    const startsAt = new Date(payload.startsAt)
    const expiresAt = new Date(payload.expiresAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: "License dates are invalid" }, { status: 400 })
    }
    if (expiresAt <= startsAt) {
      return NextResponse.json({ error: "License expiry must be after start date" }, { status: 400 })
    }

    const activeStudentCount = await prisma.student.count({ where: { status: "ACTIVE" } })
    const estimatedAmount = calculateLicenseAmount(
      activeStudentCount,
      payload.billingModel,
      payload.perStudentRate,
      payload.flatRate
    )
    const keyHash = hashLicenseKey(licenseKey)
    const now = new Date()
    const status = expiresAt < now ? "EXPIRED" : "ACTIVE"

    const license = await prisma.schoolLicense.upsert({
      where: { licenseId: payload.licenseId },
      update: {
        customerId: payload.customerId,
        customerName: payload.customerName,
        schoolName: payload.schoolName,
        planName: payload.planName,
        keyHash,
        status,
        startsAt,
        expiresAt,
        lastVerifiedAt: now,
        revokedAt: null,
        maxStudents: payload.maxStudents,
        billingModel: payload.billingModel,
        perStudentRate: payload.perStudentRate,
        flatRate: payload.flatRate ?? null,
        currency: payload.currency,
        graceDays: payload.graceDays ?? 0,
        features: payload.features || [],
        rawPayload: payload,
      },
      create: {
        licenseId: payload.licenseId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        schoolName: payload.schoolName,
        planName: payload.planName,
        keyHash,
        status,
        startsAt,
        expiresAt,
        lastVerifiedAt: now,
        maxStudents: payload.maxStudents,
        billingModel: payload.billingModel,
        perStudentRate: payload.perStudentRate,
        flatRate: payload.flatRate ?? null,
        currency: payload.currency,
        graceDays: payload.graceDays ?? 0,
        features: payload.features || [],
        rawPayload: payload,
      },
    })

    await prisma.$transaction([
      prisma.licenseEvent.create({
        data: {
          licenseId: license.id,
          type: status === "ACTIVE" ? "INSTALLED" : "EXPIRED",
          message: `${payload.planName} license installed by ${session.user.email || session.user.name}.`,
        },
      }),
      prisma.licenseBillingSnapshot.create({
        data: {
          licenseId: license.id,
          activeStudentCount,
          maxStudents: payload.maxStudents,
          billingModel: payload.billingModel,
          perStudentRate: payload.perStudentRate,
          flatRate: payload.flatRate ?? null,
          currency: payload.currency,
          estimatedAmount,
        },
      }),
    ])

    return NextResponse.json({
      message: "License installed successfully",
      license,
      activeStudentCount,
      estimatedAmount,
    })
  } catch (error) {
    console.error("Failed to install license:", error)
    return NextResponse.json({ error: "Failed to install license" }, { status: 500 })
  }
}
