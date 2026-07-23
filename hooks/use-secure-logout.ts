"use client"

import { useCallback, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function useSecureLogout() {
  const router = useRouter()

  const performSecureLogout = async (reason?: string) => {
    const callbackUrl = reason === 'idle_timeout' 
      ? '/login?reason=idle_timeout' 
      : '/login?reason=manual_logout'

    try {
      // Call session invalidation API
      try {
        await fetch('/api/auth/invalidate-session', { 
          method: 'POST',
          credentials: 'include'
        })
      } catch (error) {
        console.error('Error invalidating session:', error)
      }

      // Clear any cached data
      if (typeof window !== 'undefined') {
        // Clear session storage
        sessionStorage.clear()
        
        // Clear any relevant local storage items (be selective)
        const keysToRemove = ['user-preferences', 'app-state'] // Add your app-specific keys
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
        // Add a logout flag to prevent back navigation
        sessionStorage.setItem('logged-out', 'true')
      }

      // Perform NextAuth signOut without letting the app continue rendering a
      // protected route during the transition. A hard replace guarantees all
      // client state, RSC caches, and in-flight dashboard requests are dropped.
      await signOut({ 
        redirect: false,
        callbackUrl,
      })

      if (typeof window !== 'undefined') {
        window.location.replace(callbackUrl)
      } else {
        router.replace(callbackUrl)
      }

    } catch (error) {
      console.error('Error during logout:', error)
      // Force redirect even if signOut fails
      if (typeof window !== 'undefined') {
        window.location.replace(callbackUrl)
      } else {
        router.replace(callbackUrl)
      }
    }
  }

  return { performSecureLogout }
}

// Hook to prevent back navigation for logged out users
export function usePreventBackAfterLogout() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isLoggedOut = sessionStorage.getItem('logged-out')
    
    if (isLoggedOut) {
      // Prevent back navigation
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault()
        window.history.pushState(null, '', '/login')
        window.location.replace('/login')
      }

      window.addEventListener('popstate', handlePopState)

      // Also prevent forward navigation attempts
      window.history.pushState(null, '', window.location.href)

      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    }
  }, [])
}

// Hook to clear logout flag on successful login
export function useClearLogoutFlag() {
  const clearLogoutFlag = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('logged-out')
    }
  }, [])

  return { clearLogoutFlag }
}
