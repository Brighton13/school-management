import { NextRequest } from "next/server"

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || ""
}

export function getRequestOrigin(request: NextRequest) {
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"))
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"))
  const host = forwardedHost || request.headers.get("host")

  if (host) {
    const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https"
    return `${proto}://${host}`
  }

  return process.env.NEXTAUTH_URL || request.nextUrl.origin
}

export function buildRequestUrl(request: NextRequest, pathname: string, searchParams?: Record<string, string>) {
  const url = new URL(pathname, getRequestOrigin(request))
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value))
  }
  return url.toString()
}
