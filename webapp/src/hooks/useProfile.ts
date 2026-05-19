import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"
import { useAuth } from "../auth/useAuth"

export interface Profile {
  id: string
  user_id: string
  getting_started_done: boolean
  location_preference: 'always' | 'ask'
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

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
    const { data } = await supabase
      .from('profile')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
  }

  return { profile, loading, updateProfile }
}
