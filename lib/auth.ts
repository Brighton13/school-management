import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            permissions: {
              where: { granted: true },
              include: { permission: true }
            },
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      where: { granted: true },
                      include: { permission: true }
                    }
                  }
                }
              }
            }
          }
        })

        if (!user || !user.isActive) {
          return null
        }

        // In production, use bcrypt to compare passwords
        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          return null
        }

        // Collect permissions: If user has roles, ONLY use role permissions
        // If no roles, use direct permissions
        const permissionSet = new Set<string>()
        
        try {
          const hasRoles = user.roles && Array.isArray(user.roles) && user.roles.length > 0
          
          if (hasRoles) {
            // User has roles - ONLY use permissions from roles (ignore direct permissions)
            user.roles.forEach(userRole => {
              if (userRole?.role?.permissions && Array.isArray(userRole.role.permissions)) {
                userRole.role.permissions.forEach(rp => {
                  if (rp?.granted && rp?.permission?.name) {
                    permissionSet.add(rp.permission.name)
                  }
                })
              }
            })
          } else {
            // No roles assigned - use direct permissions
            if (user.permissions && Array.isArray(user.permissions)) {
              user.permissions.forEach(up => {
                if (up?.granted && up?.permission?.name) {
                  permissionSet.add(up.permission.name)
                }
              })
            }
          }
        } catch (error) {
          console.error("Error collecting permissions during login:", error)
          // Continue with empty permissions - login should still work
          // Permissions are optional for login, they're only needed for authorization
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: Array.from(permissionSet)
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
        token.permissions = user.permissions
        token.userId = user.id
      }
      
      // Refresh permissions on session update (e.g., when roles/permissions change)
      if (trigger === "update" && token.userId) {
        const user = await prisma.user.findUnique({
          where: { id: token.userId as string },
          include: {
            permissions: {
              where: { granted: true },
              include: { permission: true }
            },
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      where: { granted: true },
                      include: { permission: true }
                    }
                  }
                }
              }
            }
          }
        })

        if (user) {
          const permissionSet = new Set<string>()
          const hasRoles = user.roles && user.roles.length > 0
          
          if (hasRoles) {
            // User has roles - ONLY use permissions from roles (ignore direct permissions)
            user.roles.forEach(userRole => {
              userRole.role.permissions.forEach(rp => {
                if (rp.granted) permissionSet.add(rp.permission.name)
              })
            })
          } else {
            // No roles assigned - use direct permissions
            user.permissions.forEach(up => {
              if (up.granted) permissionSet.add(up.permission.name)
            })
          }
          
          token.permissions = Array.from(permissionSet)
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.permissions = token.permissions as string[]
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}

