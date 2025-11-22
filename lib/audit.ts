import { prisma } from "./prisma"
import { NextRequest } from "next/server"

interface AuditTrailData {
  userId: string
  action: string
  entityType: string
  entityId?: string
  description?: string
  ipAddress?: string
  userAgent?: string
  metadata?: any
}

export async function createAuditTrail(data: AuditTrailData) {
  try {
    await prisma.auditTrail.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || null,
        description: data.description || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
  } catch (error) {
    console.error("Error creating audit trail:", error)
    // Don't throw error - audit logging should not break the main flow
  }
}

// Helper function to get client IP and user agent from request
export function getClientInfo(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  return { ipAddress, userAgent }
}

// Helper function to log audit trail with request info
export async function logAuditTrail(
  userId: string,
  action: string,
  entityType: string,
  request: NextRequest,
  options?: {
    entityId?: string
    description?: string
    metadata?: any
  }
) {
  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditTrail({
    userId,
    action,
    entityType,
    entityId: options?.entityId,
    description: options?.description,
    ipAddress,
    userAgent,
    metadata: options?.metadata,
  })
}

