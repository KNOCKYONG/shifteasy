'use client'

import { useCallback } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useQueryClient } from '@tanstack/react-query'

export function useFullSignOut() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useCallback(async () => {
    try {
      queryClient.clear()

      const theme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
      const language = typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') : null

      if (typeof window !== 'undefined') {
        localStorage.clear()
        if (theme) localStorage.setItem('theme', theme)
        if (language) localStorage.setItem('i18nextLng', language)
        sessionStorage.clear()
      }

      await supabase.auth.signOut()

      if (typeof window !== 'undefined') {
        window.location.href = '/sign-in'
      }
    } catch (error) {
      console.error('Sign out error:', error)
      queryClient.clear()
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/sign-in'
      }
    }
  }, [supabase, queryClient])
}
