import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"
import { useAuth } from "../auth/useAuth"
import type { Profile } from "@shared/types"

export type { Profile }

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { setProfile(null); return }
    setLoading(true)
    supabase
      .from('profile')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data)
        setLoading(false)
      })
  }, [user])

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return
    const { data, error } = await supabase
      .from('profile')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProfile(data)
  }

  return { profile, loading, updateProfile }
}
