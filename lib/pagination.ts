// Pagination utility types and helpers

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
    hasPrevious: boolean
  }
}

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number
  limit: number
  offset: number
} {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  let limit = parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)
  
  // Ensure limit is within bounds
  limit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE)
  
  // Support both offset-based and page-based pagination
  const explicitOffset = searchParams.get("offset")
  const offset = explicitOffset 
    ? parseInt(explicitOffset, 10) 
    : (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Create paginated response object
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit)
  
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      hasPrevious: page > 1,
    },
  }
}

/**
 * Get pagination SQL clause for raw queries
 */
export function getPaginationClause(limit: number, offset: number): string {
  return `LIMIT ${limit} OFFSET ${offset}`
}
