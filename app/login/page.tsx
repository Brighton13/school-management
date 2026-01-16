// "use client"

// import { useState, useEffect } from "react"
// import { signIn } from "next-auth/react"
// import { useRouter, useSearchParams } from "next/navigation"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { GraduationCap, AlertCircle } from "lucide-react"
// import { ThemeToggle } from "@/components/theme-toggle"
// import Link from "next/link"

// export default function LoginPage() {
//   const router = useRouter()
//   const searchParams = useSearchParams()
//   const [email, setEmail] = useState("")
//   const [password, setPassword] = useState("")
//   const [error, setError] = useState("")
//   const [loading, setLoading] = useState(false)
//   const [idleTimeoutMessage, setIdleTimeoutMessage] = useState(false)

//   useEffect(() => {
//     if (searchParams.get("reason") === "idle_timeout") {
//       setIdleTimeoutMessage(true)
//     }
//   }, [searchParams])

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setError("")
//     setLoading(true)

//     try {
//       const result = await signIn("credentials", {
//         email,
//         password,
//         redirect: false,
//       })

//       if (result?.error) {
//         setError("Invalid email or password")
//       } else {
//         // Log session
//         try {
//           await fetch("/api/session-logs", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//           })
//         } catch (error) {
//           console.error("Failed to log session:", error)
//         }
//         router.push("/dashboard")
//         router.refresh()
//       }
//     } catch (error) {
//       setError("An error occurred. Please try again.")
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <div className="min-h-screen flex">
//       {/* Theme toggle - fixed position */}
//       <div className="fixed top-4 right-4 z-50">
//         <ThemeToggle />
//       </div>

//       {/* Left side - Image */}
//       <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 to-indigo-800 dark:from-blue-800 dark:to-indigo-950">
//         <div className="absolute inset-0 bg-black/20"></div>
//         <div className="relative z-10 flex flex-col items-center justify-center p-12 text-white">
//           <div className="mb-8">
//             <div className="rounded-full bg-white/20 backdrop-blur-sm p-6 mb-6">
//               <GraduationCap className="h-16 w-16 text-white" />
//             </div>
//             <h1 className="text-4xl font-bold mb-4">School Management System</h1>
//             <p className="text-xl text-blue-100">
//               Streamline your school operations with our comprehensive management platform
//             </p>
//           </div>
//           <div className="mt-8 grid grid-cols-3 gap-4 text-center">
//             <div>
//               <div className="text-3xl font-bold">100+</div>
//               <div className="text-sm text-blue-200">Schools</div>
//             </div>
//             <div>
//               <div className="text-3xl font-bold">50K+</div>
//               <div className="text-sm text-blue-200">Students</div>
//             </div>
//             <div>
//               <div className="text-3xl font-bold">5K+</div>
//               <div className="text-sm text-blue-200">Teachers</div>
//             </div>
//           </div>
//         </div>
//         {/* Decorative elements */}
//         <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
//           <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
//           <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
//         </div>
//       </div>

//       {/* Right side - Login Form */}
//       <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
//         <Card className="w-full max-w-md shadow-lg">
//           <CardHeader className="space-y-1 text-center px-4 sm:px-6 pt-6 sm:pt-8">
//             <div className="flex justify-center mb-4 lg:hidden">
//               <div className="rounded-full bg-primary p-3">
//                 <GraduationCap className="h-8 w-8 text-primary-foreground" />
//               </div>
//             </div>
//             <CardTitle className="text-xl sm:text-2xl font-bold">Welcome Back</CardTitle>
//             <CardDescription className="text-sm sm:text-base">
//               Enter your credentials to access your account
//             </CardDescription>
//           </CardHeader>
//           <form onSubmit={handleSubmit}>
//             <CardContent className="space-y-4 px-4 sm:px-6">
//               {idleTimeoutMessage && (
//                 <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800">
//                   <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
//                   <AlertDescription className="text-xs sm:text-sm text-orange-800 dark:text-orange-200">
//                     Your session has expired due to inactivity. Please log in again.
//                   </AlertDescription>
//                 </Alert>
//               )}
//               {error && (
//                 <div className="p-3 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
//                   {error}
//                 </div>
//               )}
//               <div className="space-y-2">
//                 <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
//                 <Input
//                   id="email"
//                   type="email"
//                   placeholder="name@example.com"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   required
//                   className="h-10 sm:h-11 text-sm sm:text-base"
//                 />
//               </div>
//               <div className="space-y-2">
//                 <div className="flex items-center justify-between">
//                   <Label htmlFor="password" className="text-sm sm:text-base">Password</Label>
//                   <Link
//                     href="/forgot-password"
//                     className="text-xs sm:text-sm text-primary hover:underline"
//                   >
//                     Forgot password?
//                   </Link>
//                 </div>
//                 <Input
//                   id="password"
//                   type="password"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   required
//                   className="h-10 sm:h-11 text-sm sm:text-base"
//                 />
//               </div>
//             </CardContent>
//             <CardFooter className="flex flex-col space-y-3 sm:space-y-4 px-4 sm:px-6 pb-6 sm:pb-8">
//               <Button type="submit" className="w-full h-10 sm:h-11 text-sm sm:text-base" disabled={loading}>
//                 {loading ? "Signing in..." : "Sign In"}
//               </Button>
//               <p className="text-xs text-center text-muted-foreground px-2">
//                 By signing in, you agree to our Terms of Service and Privacy Policy
//               </p>
//             </CardFooter>
//           </form>
//         </Card>
//       </div>
//     </div>
//   )
// }


"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useClearLogoutFlag } from "@/hooks/use-secure-logout"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { clearLogoutFlag } = useClearLogoutFlag()

  // Note: Replace these with your actual imports
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const reason = searchParams.get("reason")
    
    if (reason === "idle_timeout") {
      toast({
        title: "Session Expired",
        description: "Your session has expired due to inactivity. Please log in again.",
        variant: "destructive",
      })
    } else if (reason === "manual_logout") {
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      })
    }

    // Clear any logout flags when visiting login page
    clearLogoutFlag()
  }, [searchParams, toast, clearLogoutFlag])

  const handleSubmit = async (e:any) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Replace with your actual signIn function
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        })
      } else {
        try {
          await fetch("/api/session-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
        } catch (error) {
          console.error("Failed to log session:", error)
        }
        toast({
          title: "Welcome Back!",
          description: "You have successfully signed in.",
        })
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Theme toggle - fixed position */}
      <div className="fixed top-4 right-4 z-50">
        {/* Replace with your ThemeToggle component */}
        {/* <Button variant="outline" size="icon" className="h-9 w-9 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
          <span className="text-sm">🌓</span>
        </Button> */}
      </div>

      {/* Left side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-3 sm:p-4 md:p-6">
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center px-4 sm:px-6 pt-6 sm:pt-8">
            <div className="flex justify-center mb-3 lg:hidden">
              <div className="rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 p-3 shadow-lg">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-50">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Sign in to continue to your dashboard
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 px-4 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 sm:h-11 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <a
                  href="/forgot-password"
                  className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 sm:h-11 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-3 sm:space-y-4 px-4 sm:px-6 pb-6 sm:pb-8">
            <Button 
              type="submit"
              onClick={handleSubmit}
              className="w-full h-10 sm:h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all" 
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 leading-relaxed px-2">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* Right side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/login-background.jpg')" }}
        ></div>
        
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-indigo-900/70 to-purple-900/80 dark:from-slate-950/90 dark:via-blue-950/85 dark:to-indigo-950/90"></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-white w-full">
          <div className="text-center max-w-lg">
            {/* Hero illustration */}
                       
            <h1 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight leading-tight">
              School Management
              <br />
              <span className="text-blue-200 dark:text-blue-300">Made Simple</span>
            </h1>
            <p className="text-lg lg:text-xl text-blue-100 dark:text-slate-300 leading-relaxed mb-8">
              Streamline operations, enhance communication, and empower your educational institution with our comprehensive platform
            </p>
            
            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                <span className="text-sm font-medium">✓ Student Management</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                <span className="text-sm font-medium">✓ Grade Tracking</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                <span className="text-sm font-medium">✓ Attendance</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative blobs */}
        <div className="absolute top-1/4 -right-12 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>
      </div>
    </div>
  )
}