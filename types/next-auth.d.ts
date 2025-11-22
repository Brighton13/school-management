import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      permissions: string[]
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    permissions: string[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    permissions: string[]
  }
}

