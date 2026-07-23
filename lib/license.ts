import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export type LicensePayload = {
  version: 1
  licenseId: string
  customerId: string
  customerName: string
  schoolName: string
  planName: string
  startsAt: string
  expiresAt: string
  maxStudents: number
  billingModel: "PER_STUDENT" | "FLAT" | "HYBRID"
  perStudentRate: number
  flatRate?: number | null
  currency: string
  graceDays?: number
  features?: string[]
}

export type LicenseStatus = {
  state: "ACTIVE" | "GRACE" | "EXPIRED" | "MISSING" | "OVER_LIMIT" | "INVALID"
  message: string
  license: Awaited<ReturnType<typeof getLatestLicenseRecord>>
  activeStudentCount: number
  daysUntilExpiry: number | null
  estimatedAmount: number
}

const encoder = new TextEncoder()

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function getSigningSecret() {
  return process.env.LICENSE_SIGNING_SECRET || process.env.NEXT_PUBLIC_LICENSE_SIGNING_SECRET || ""
}

export function hashLicenseKey(licenseKey: string) {
  return crypto.createHash("sha256").update(licenseKey).digest("hex")
}

export function signLicensePayload(payload: LicensePayload, secret = getSigningSecret()) {
  if (!secret) {
    throw new Error("LICENSE_SIGNING_SECRET is required to sign licenses")
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url")

  return `${encodedPayload}.${signature}`
}

export function verifyLicenseKey(licenseKey: string, secret = getSigningSecret()) {
  if (!secret) {
    return { valid: false as const, error: "LICENSE_SIGNING_SECRET is not configured" }
  }

  const [encodedPayload, signature] = licenseKey.trim().split(".")
  if (!encodedPayload || !signature) {
    return { valid: false as const, error: "Invalid license key format" }
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url")

  const expectedBytes = encoder.encode(expectedSignature)
  const signatureBytes = encoder.encode(signature)
  if (
    expectedBytes.length !== signatureBytes.length ||
    !crypto.timingSafeEqual(expectedBytes, signatureBytes)
  ) {
    return { valid: false as const, error: "License signature is invalid" }
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as LicensePayload
    const requiredFields = [
      payload.version,
      payload.licenseId,
      payload.customerId,
      payload.customerName,
      payload.schoolName,
      payload.planName,
      payload.startsAt,
      payload.expiresAt,
      payload.maxStudents,
      payload.billingModel,
      payload.currency,
    ]

    if (requiredFields.some((field) => field === undefined || field === null || field === "")) {
      return { valid: false as const, error: "License payload is incomplete" }
    }

    if (!Number.isFinite(payload.maxStudents) || payload.maxStudents < 1) {
      return { valid: false as const, error: "License student limit is invalid" }
    }

    return { valid: true as const, payload }
  } catch {
    return { valid: false as const, error: "License payload cannot be read" }
  }
}

export async function getLatestLicenseRecord() {
  return prisma.schoolLicense.findFirst({
    orderBy: [{ installedAt: "desc" }],
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      billingSnapshots: {
        orderBy: { capturedAt: "desc" },
        take: 6,
      },
    },
  })
}

export function calculateLicenseAmount(
  activeStudentCount: number,
  billingModel: string,
  perStudentRate: number,
  flatRate?: number | null
) {
  if (billingModel === "FLAT") return flatRate || 0
  if (billingModel === "HYBRID") return (flatRate || 0) + activeStudentCount * perStudentRate
  return activeStudentCount * perStudentRate
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (process.env.LICENSE_ENFORCEMENT_DISABLED === "true") {
    const activeStudentCount = await prisma.student.count({ where: { status: "ACTIVE" } })
    return {
      state: "ACTIVE",
      message: "License enforcement is disabled by environment configuration.",
      license: null,
      activeStudentCount,
      daysUntilExpiry: null,
      estimatedAmount: 0,
    }
  }

  const [license, activeStudentCount] = await Promise.all([
    getLatestLicenseRecord(),
    prisma.student.count({ where: { status: "ACTIVE" } }),
  ])

  if (!license) {
    return {
      state: "MISSING",
      message: "No subscription license is installed.",
      license,
      activeStudentCount,
      daysUntilExpiry: null,
      estimatedAmount: 0,
    }
  }

  const now = new Date()
  const expiresAt = new Date(license.expiresAt)
  const graceExpiresAt = new Date(expiresAt)
  graceExpiresAt.setDate(graceExpiresAt.getDate() + license.graceDays)
  const msUntilExpiry = expiresAt.getTime() - now.getTime()
  const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24))
  const estimatedAmount = calculateLicenseAmount(
    activeStudentCount,
    license.billingModel,
    license.perStudentRate,
    license.flatRate
  )

  if (license.status === "REVOKED") {
    return {
      state: "INVALID",
      message: "This license has been revoked.",
      license,
      activeStudentCount,
      daysUntilExpiry,
      estimatedAmount,
    }
  }

  if (activeStudentCount > license.maxStudents) {
    return {
      state: "OVER_LIMIT",
      message: `Active students exceed the licensed limit of ${license.maxStudents}.`,
      license,
      activeStudentCount,
      daysUntilExpiry,
      estimatedAmount,
    }
  }

  if (now > graceExpiresAt) {
    return {
      state: "EXPIRED",
      message: "The subscription license has expired and must be renewed.",
      license,
      activeStudentCount,
      daysUntilExpiry,
      estimatedAmount,
    }
  }

  if (now > expiresAt) {
    return {
      state: "GRACE",
      message: "The subscription license is expired and running in grace period.",
      license,
      activeStudentCount,
      daysUntilExpiry,
      estimatedAmount,
    }
  }

  return {
    state: "ACTIVE",
    message: "Subscription license is active.",
    license,
    activeStudentCount,
    daysUntilExpiry,
    estimatedAmount,
  }
}

export function isLicenseBlocking(state: LicenseStatus["state"]) {
  return state === "MISSING" || state === "EXPIRED" || state === "OVER_LIMIT" || state === "INVALID"
}
